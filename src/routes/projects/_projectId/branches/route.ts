import { FastifyInstance, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../../lib/auth";
import { stdNoAuth, stdReply } from "../../../../lib/std-reply";
import { createBranchSchema } from "../../../../schema/branchesSchema";

type RouteParams = {
  projectId: string;
};

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  // CREATE BRANCH
  fastify.post(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const { projectId } = request.params as RouteParams;

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      // NB: Can only create branches on own projects
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
          clientMessage: `No project ${projectId} found`,
        });
      }

      if (project.createdByUserId !== request.user.id) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "validation",
            details: `${request.user.id} !== ${project.createdByUserId}`,
          },
          clientMessage: "You can only create branches on your own projects",
        });
      }

      const details = await createBranchSchema.parseAsync(request.body);

      // We can't have duplicate branches
      const duplicateMatches = project.branches.filter(
        (it) => it.name.toLowerCase() === details.name.toLowerCase()
      );

      if (duplicateMatches.length > 0) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "conflict",
          },
          clientMessage: "You already have a branch with this name",
        });
      }

      // Now we know it's a valid project & it belongs to the user, create branch
      const branch = await fastify.prisma.branch.create({
        data: {
          ...details,
          project: {
            connect: {
              id: project.id,
            },
          },
        },
      });

      return stdReply(reply, {
        data: branch,
        clientMessage: `Success! Created branch ${branch.name}`,
      });
    }
  );

  // GET ALL BRANCHES IN PROJECT
  fastify.get(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const { projectId } = request.params as RouteParams;

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const branches = await fastify.prisma.branch.findMany({
        where: {
          projectId: projectId,
          project: {
            createdByUserId: request.user.id,
          },
        },
      });

      return stdReply(reply, {
        data: branches,
        clientMessage: `Found ${branches.length} branches`,
      });
    }
  );
}
