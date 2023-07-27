import { FastifyInstance, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../lib/auth";
import { stdNoAuth, stdNoMultipart, stdReply } from "../../../lib/std-reply";
import { MultipartFile } from "@fastify/multipart";
import { updateProjectSchema } from "../../../schema/projectsSchema";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getObjectURL } from "../../../lib/bucket-helpers";
import { s3 } from "../../../server";

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  // GET SINGLE PROJECT
  fastify.get(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const { id } = request.params as { id: string };

      const project = await fastify.prisma.project.findFirst({
        where: {
          id,
        },
      });

      if (!project) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "not-found",
          },
          clientMessage: `Project ${id} not found`,
        });
      }

      // NB: at the moment only show users their own projects
      // TODO: expand on this
      if (request.user.id !== project.createdByUserId) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "auth",
            details: `${request.user.id} !== ${project.createdByUserId}`,
          },
          clientMessage: "You can only view your own projects",
        });
      }

      return stdReply(reply, {
        data: project,
      });
    }
  );

  // UPDATE USER
  fastify.patch(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (!request.isMultipart()) {
        return stdReply(reply, stdNoMultipart);
      }

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const parts = request.parts();
      let rawTextDetails: any = {};

      const coverArtFieldname = "coverArt";
      let coverArtPart: MultipartFile | undefined;
      let coverArtBuffer;

      for await (const part of parts) {
        if (part.type !== "file") {
          rawTextDetails[part.fieldname] = part.value;
        } else {
          if (part.fieldname === coverArtFieldname) {
            coverArtPart = part;
            coverArtBuffer = await part.toBuffer();
          } else {
            // Can we do something better?
            // Note: we MUST consume all parts
            // From: https://github.com/fastify/fastify-multipart
            await part.toBuffer();
          }
        }
      }

      // zod parse these text details
      const details = await updateProjectSchema.parseAsync(rawTextDetails);

      if (details.name) {
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
      }

      // TODO: Anything else?

      const updatedProject = await fastify.prisma.project.update({
        where: {
          id,
        },
        data: {
          ...details,
          updatedAt: new Date(),
        },
      });

      let replyDetails = updatedProject;

      // If there's a cover art, upload it to the cloud
      // Only do this if we KNOW that we have created the object as we require the ID
      // NB: This will overwrite any existing cover arts
      if (coverArtPart) {
        const filename = coverArtPart.filename;
        const extension = filename.slice(filename.lastIndexOf("."));
        const path = `${request.user.id}/${updatedProject.id}/coverArt${extension}`;

        const putObjectCommand = new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET,
          Key: path,
          Body: coverArtBuffer,
          ContentType: coverArtPart.mimetype,
        });

        await s3.send(putObjectCommand);

        // Now get the URL of this newly created object
        const url = getObjectURL(path);

        // And update the createdProject
        replyDetails = await fastify.prisma.project.update({
          where: {
            id: updatedProject.id,
          },
          data: {
            coverArtURL: url,
            updatedAt: new Date(),
          },
        });
      }

      stdReply(reply, {
        data: replyDetails,
        clientMessage: `Updated project ${details.name}`,
      });
    }
  );

  // DELETE PROJECT
  fastify.delete(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const { id } = request.params as { id: string };

      // get this project
      const project = await fastify.prisma.project.findFirst({
        where: {
          id,
        },
      });

      if (!project) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "not-found",
          },
          clientMessage: `Project ${id} not found`,
        });
      }

      // Make sure project is own
      if (request.user.id !== project.createdByUserId) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "auth",
            details: `${request.user.id} !== ${project.createdByUserId}`,
          },
          clientMessage: "You can only delete your own projects",
        });
      }

      // Now we can delete project
      await fastify.prisma.project.delete({
        where: {
          id,
        },
      });

      return stdReply(reply, {
        clientMessage: `Success! Deleted project ${project.id}`,
      });
    }
  );
}
