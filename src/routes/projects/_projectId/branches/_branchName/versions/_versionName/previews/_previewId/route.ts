import { MultipartFile } from "@fastify/multipart";
import { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../../../../../../../lib/auth";
import { stdNoAuth, stdReply } from "../../../../../../../../../lib/std-reply";

type RouteParams = {
  previewId: string;
  versionName: string;
  branchName: string;
  projectId: string;
};

type FileWithBuffer = {
  file: MultipartFile;
  buffer: Buffer;
};

// Decodes the branchName & versionName for us
function parseParams(request: FastifyRequest): RouteParams {
  const {
    versionName: rawVersionName,
    branchName: rawBranchName,
    projectId,
    previewId,
  } = request.params as RouteParams;

  return {
    branchName: decodeURIComponent(rawBranchName).toLowerCase(),
    projectId,
    versionName: decodeURIComponent(rawVersionName).toLowerCase(),
    previewId,
  };
}

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  fastify.delete(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const { branchName, versionName, projectId, previewId } =
        parseParams(request);

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const preview = await fastify.prisma.preview.findFirst({
        where: {
          id: previewId,
        },
        include: {
          version: {
            include: {
              branch: {
                include: {
                  project: {
                    select: {
                      createdByUserId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!preview) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "not-found",
          },
          clientMessage: `Preview ${previewId} on version ${versionName} on branch ${branchName} in project ${projectId} not found`,
        });
      }

      // Only the owner of the project can get previews
      const ownerId = preview.version.branch.project.createdByUserId;

      if (ownerId !== request.user.id) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "auth",
            details: `${request.user.id} !== ${ownerId}`,
          },
          clientMessage: "You can only delete previews on your own versions",
        });
      }

      // Delete version
      await fastify.prisma.preview.delete({
        where: {
          id: previewId,
        },
      });

      return stdReply(reply, {
        clientMessage: `Success! Deleted preview ${previewId}`,
      });
    }
  );
}
