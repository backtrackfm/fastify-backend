import { FastifyInstance, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../lib/auth";
import { stdNoAuth, stdReply } from "../../../lib/std-reply";

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  // Get onboarding status
  fastify.get(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const userId = request.user.id;

      // has this user created a project?
      const projects = await fastify.prisma.project.count({
        where: {
          createdByUserId: userId,
        },
      });

      // has this user created any branches? (ignore original)
      const branches = await fastify.prisma.branch.count({
        where: {
          name: {
            not: "original",
          },
          project: {
            createdByUserId: userId,
          },
        },
      });

      // has this user created any versions?
      const versions = await fastify.prisma.version.count({
        where: {
          branch: {
            project: {
              createdByUserId: userId,
            },
          },
        },
      });

      // now lets send all this info
      return stdReply(reply, {
        data: {
          project: projects > 0,
          branch: branches > 0,
          version: versions > 0,
        },
      });
    }
  );
}
