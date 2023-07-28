import { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../../../../../lib/auth";
import { stdNoAuth, stdReply } from "../../../../../../../lib/std-reply";

type RouteParams = {
  versionName: string;
  branchName: string;
  projectId: string;
};

// Decodes the branchName & versionNae for us
function parseParams(request: FastifyRequest): RouteParams {
  const {
    versionName: rawVersionName,
    branchName: rawBranchName,
    projectId,
  } = request.params as RouteParams;

  return {
    branchName: decodeURIComponent(rawBranchName).toLowerCase(),
    projectId,
    versionName: decodeURIComponent(rawVersionName).toLowerCase(),
  };
}

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  fastify.get(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const { branchName, versionName, projectId } = parseParams(request);

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const version = await fastify.prisma.version.findFirst({
        where: {
          AND: {
            branchName,
            name: versionName,
            projectId,
          },
        },
        include: {
          branch: {
            include: {
              project: true,
            },
          },
        },
      });

      if (!version) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "not-found",
          },
          clientMessage: `Version ${versionName} on branch ${branchName} in project ${projectId} not found`,
        });
      }

      // Only the owner of the project can get versions
      if (version.branch.project.createdByUserId !== request.user.id) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "auth",
            details: `${request.user.id} !== ${version.branch.project.createdByUserId}`,
          },
          clientMessage: "You can only get versions on your own branches",
        });
      }

      const { branch, ...replyDetails } = version;

      return stdReply(reply, {
        data: replyDetails,
      });
    }
  );
}
