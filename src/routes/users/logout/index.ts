import { FastifyInstance, RouteOptions } from "fastify";
import { stdReply } from "../../../lib/std-reply";
import { redirectToLogin } from "../../../lib/auth";

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  fastify.post(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      request.logOut();

      return stdReply(reply, {
        clientMessage: "Success! User logged out",
      });
    }
  );
}
