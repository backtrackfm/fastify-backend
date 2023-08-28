import { MultipartFile } from "@fastify/multipart";
import { FastifyInstance, RouteOptions } from "fastify";
import { redirectToLogin } from "../../lib/auth";
import { getSignedObjectURL, uploadFile } from "../../lib/aws-storage";
import { stdNoAuth, stdNoMultipart, stdReply } from "../../lib/std-reply";
import { createProjectSchema } from "../../schema/projectsSchema";

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  // GET ALL OF MY PROJECTS
  fastify.get(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const projects = await fastify.prisma.project.findMany({
        where: {
          createdByUserId: request.user.id,
        },
      });

      const promises = projects.map(async (proj) => {
        let url = "";

        if (proj.coverArtStoragePath) {
          url = await getSignedObjectURL(proj.coverArtStoragePath);
        }

        return {
          ...proj,
          coverArtURL: url,
        };
      });

      const projectsWithUrls = await Promise.all(promises);

      return stdReply(reply, {
        data: projectsWithUrls,
        clientMessage: `Found ${projects.length} projects`,
      });
    }
  );

  // CREATE PROJECT
  fastify.post(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      if (!request.isMultipart()) {
        return stdReply(reply, stdNoMultipart);
      }

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const parts = request.parts();
      const coverArtFieldname = "coverArt";
      let coverArtPart: MultipartFile | undefined;

      let coverArtBuffer;
      let body;

      for await (const part of parts) {
        if (part.type === "file") {
          if (part.fieldname === coverArtFieldname) {
            coverArtPart = part;
            coverArtBuffer = await part.toBuffer();
          } else {
            // Can we do something better?
            // Note: we MUST consume all parts
            // From: https://github.com/fastify/fastify-multipart
            await part.toBuffer();
          }
        } else {
          if (part.fieldname === "body") {
            body = JSON.parse(part.value as string); // must be a string, this is ok.
          }
        }
      }

      // zod parse these text details
      const details = await createProjectSchema.parseAsync(body);

      // Ensure that this user doesn't already have a project with this name
      const userProjectsWithName = await fastify.prisma.project.count({
        where: {
          createdByUserId: request.user.id,
          name: {
            equals: details.name,
            mode: "insensitive",
          },
        },
      });

      if (userProjectsWithName > 0) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "conflict",
            details: `${userProjectsWithName} project(s) with same name`,
          },
          clientMessage: `You already have a project called ${details.name}`,
        });
      }

      // TODO: Anything else?

      const createdProject = await fastify.prisma.project.create({
        data: {
          ...details,
          createdBy: {
            connect: {
              id: request.user.id,
            },
          },
          branches: {
            create: {
              name: "original",
              description: "The default branch",
            },
          },
        },
      });

      let replyDetails = createdProject;
      let url = "";

      // If there's a cover art, upload it to the cloud
      // Only do this if we KNOW that we have created the object as we require the ID
      if (coverArtPart) {
        console.log("hello");
        const filename = coverArtPart.filename;
        const extension = filename.slice(filename.lastIndexOf("."));
        const path = `${request.user.id}/${createdProject.id}/coverArt${extension}`;

        // Create object in s3
        await uploadFile(coverArtBuffer, coverArtPart.mimetype, path);

        // And update the createdProject
        replyDetails = await fastify.prisma.project.update({
          where: {
            id: createdProject.id,
          },
          data: {
            coverArtStoragePath: path,
            updatedAt: new Date(),
          },
        });

        url = await getSignedObjectURL(path);
      }

      stdReply(reply, {
        data: { ...replyDetails, url },
        clientMessage: `Created project ${details.name}`,
      });
    }
  );
}
