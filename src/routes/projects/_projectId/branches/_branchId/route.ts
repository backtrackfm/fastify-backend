import { FastifyInstance, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../../../lib/auth";
import { stdNoAuth, stdReply } from "../../../../../lib/std-reply";
import { updateBranchSchema } from "../../../../../schema/branchesSchema";

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  // GET BRANCH BY ID
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

  // DELETE BRANCH
  fastify.delete(
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

      if (branch.project.createdByUserId !== request.user.id) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "validation",
            details: `${request.user.id} !== ${branch.project.createdByUserId}`,
          },
          clientMessage: "You can only delete branches from your own projects",
        });
      }

      await fastify.prisma.branch.delete({
        where: {
          id: branchId,
        },
      });

      return stdReply(reply, {
        clientMessage: `Success! Deleted branch ${branch.id}`,
      });
    }
  );

  // UPDATE BRANCH
  fastify.patch(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const { projectId, branchId } = request.params as {
        projectId: string;
        branchId: string;
      };

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const branch = await fastify.prisma.branch.findFirst({
        where: {
          projectId,
          id: branchId,
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

      if (branch.project.createdByUserId !== request.user.id) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "validation",
            details: `${request.user.id} !== ${branch.project.createdByUserId}`,
          },
          clientMessage: "You can only edit branches from your own projects",
        });
      }

      const details = await updateBranchSchema.parseAsync(request.body);

      const updatedBranch = await fastify.prisma.branch.update({
        data: {
          ...details,
          updatedAt: new Date(),
        },
        where: {
          id: branchId,
          projectId: projectId,
        },
      });

      stdReply(reply, {
        data: updatedBranch,
        clientMessage: `Updated branch ${updatedBranch.name}`,
      });
    }
  );
}
