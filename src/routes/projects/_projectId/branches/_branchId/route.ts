import { FastifyInstance, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../../../lib/auth";
import { stdNoAuth, stdReply } from "../../../../../lib/std-reply";

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
      const { branchId, projectId } = request.params as {
        projectId: string;
        branchId: string;
      };

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const branch = await fastify.prisma.branch.findFirst({
        where: {
          id: branchId,
          projectId: projectId,
        },
        include: {
          project: true,
        },
      });

      if (!branch) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "not-found",
          },
          clientMessage: `No branch ${branchId} found`,
        });
      }

      const { project, ...rest } = branch;

      if (branch.project.createdByUserId !== request.user.id) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "validation",
            details: `${request.user.id} !== ${branch.project.createdByUserId}`,
          },
          clientMessage: "You can only get branches from your own projects",
        });
      }

      return stdReply(reply, {
        data: rest,
      });
    }
  );
}
