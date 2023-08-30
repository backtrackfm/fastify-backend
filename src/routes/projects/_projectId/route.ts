import { FastifyInstance, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../lib/auth";
import {
  deleteFile,
  deleteFolder,
  getSignedObjectURL,
  uploadFile,
} from "../../../lib/aws-storage";
import { processFileParts } from "../../../lib/multipart-utils";
import { stdNoAuth, stdNoMultipart, stdReply } from "../../../lib/std-reply";
import { updateProjectSchema } from "../../../schema/projectsSchema";

type RouteParams = {
  projectId: string;
};

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

      const { projectId } = request.params as RouteParams;

      const project = await fastify.prisma.project.findFirst({
        where: {
          id: projectId,
        },
        include: {
          branches: true,
        },
      });

      if (!project) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "not-found",
          },
          clientMessage: `Project ${projectId} not found`,
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

      let url = "";

      if (project.coverArtStoragePath) {
        url = await getSignedObjectURL(project.coverArtStoragePath);
      }

      return stdReply(reply, {
        data: {
          ...project,
          coverArtURL: url,
        },
      });
    }
  );

  // UPDATE PROJECT
  fastify.patch(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const { projectId } = request.params as RouteParams;

      if (!request.isMultipart()) {
        return stdReply(reply, stdNoMultipart);
      }

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const { body, files } = await processFileParts(request.parts(), [
        "coverArt",
      ]);

      // zod parse these text details
      const details = await updateProjectSchema.parseAsync(body);

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
          id: projectId,
        },
        data: {
          ...details,
          updatedAt: new Date(),
        },
      });

      let replyDetails = updatedProject;
      let url = "";

      const coverArt = files["coverArt"];

      // If there's a cover art, upload it to the cloud
      // Only do this if we KNOW that we have created the object as we require the ID
      // NB: This will overwrite any existing cover arts
      if (coverArt) {
        const filename = coverArt.file.filename;
        const extension = filename.slice(filename.lastIndexOf("."));
        const path = `${request.user.id}/${updatedProject.id}/coverArt${extension}`;

        await uploadFile(coverArt.buffer, coverArt.file.mimetype, path);

        // Now get the URL of this newly created object
        url = await getSignedObjectURL(path);

        // And update the createdProject
        replyDetails = await fastify.prisma.project.update({
          where: {
            id: updatedProject.id,
          },
          data: {
            coverArtStoragePath: path,
            updatedAt: new Date(),
          },
        });
      }

      stdReply(reply, {
        data: { ...replyDetails, url },
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

      const { projectId } = request.params as RouteParams;

      // get this project
      const project = await fastify.prisma.project.findFirst({
        where: {
          id: projectId,
        },
      });

      if (!project) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "not-found",
          },
          clientMessage: `Project ${projectId} not found`,
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

      deleteFolder(`${request.user.id}/${project.id}`);

      // Now we can delete project
      await fastify.prisma.project.delete({
        where: {
          id: projectId,
        },
      });

      return stdReply(reply, {
        clientMessage: `Success! Deleted project ${project.id}`,
      });
    }
  );
}
