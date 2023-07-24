import { FastifyInstance, RouteOptions } from "fastify";
import { stdNoAuth, stdReply } from "../../lib/std-reply";
import { redirectToLogin } from "../../lib/auth";

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  fastify.get(
    "/",
    {
      preValidation: async (request, reply) =>
        await redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const user = request.user;

      if (!user) {
        return stdReply(reply, stdNoAuth);
      }

      stdReply(reply, {
        clientMessage: "Locked page: " + user.id,
      });
    }
  );
}
