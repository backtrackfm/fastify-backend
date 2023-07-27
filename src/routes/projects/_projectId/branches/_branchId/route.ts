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
      // const { projectId } =

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }
    }
  );
}
