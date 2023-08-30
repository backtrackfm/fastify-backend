import { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../../../lib/auth";
import { deleteFolder, renameFile } from "../../../../../lib/aws-storage";
import { stdNoAuth, stdReply } from "../../../../../lib/std-reply";
import { updateBranchSchema } from "../../../../../schema/branchesSchema";

type RouteParams = {
  branchName: string;
  projectId: string;
};

// Encodes the branchName for us
function parseParams(request: FastifyRequest) {
  const { branchName: rawBranchName, projectId } =
    request.params as RouteParams;

  return {
    branchName: decodeURIComponent(rawBranchName).toLowerCase(),
    projectId,
  };
}

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
      const { branchName, projectId } = parseParams(request);

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const branch = await fastify.prisma.branch.findFirst({
        where: {
          AND: {
            name: branchName,
            projectId: projectId,
          },
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
          clientMessage: `No branch ${branchName} found`,
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
      const { branchName, projectId } = parseParams(request);

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const branch = await fastify.prisma.branch.findFirst({
        where: {
          name: branchName,
          projectId: projectId,
        },
        include: {
          project: true,
          versions: true,
        },
      });

      if (!branch) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "not-found",
          },
          clientMessage: `No branch ${branchName} found`,
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
          name_projectId: {
            name: branchName,
            projectId: projectId,
          },
        },
      });

      // We must delete all the files or folders inside of the branch folders
      // Use all of the versions
      for (const it of branch.versions) {
        deleteFolder(
          `/${request.user.id}/${projectId}/${branchName}/${it.name}`
        );
      }

      return stdReply(reply, {
        clientMessage: `Success! Deleted branch ${branch.name}`,
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
      const { projectId, branchName } = parseParams(request);

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const branch = await fastify.prisma.branch.findFirst({
        where: {
          AND: {
            name: branchName,
            projectId: projectId,
          },
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
          clientMessage: `No branch ${branchName} found`,
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
          name_projectId: {
            name: branchName,
            projectId,
          },
        },
      });

      // Update S3 if we have a new branch name
      if (details.name) {
        renameFile(
          `/${request.user.id}/${projectId}/${branchName}`,
          `/${request.user.id}/${projectId}/${details.name}`
        );
      }

      stdReply(reply, {
        data: updatedBranch,
        clientMessage: `Updated branch ${updatedBranch.name}`,
      });
    }
  );
}
