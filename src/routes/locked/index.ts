import passport from "@fastify/passport";
import { FastifyInstance, RouteOptions } from "fastify";
import { loginPageRoute } from "../../lib/consts";
import { User } from "@prisma/client";
import { stdReply } from "../../lib/std-reply";
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
        return stdReply(reply, {
          error: {
            code: 400,
            type: "validation",
          },
          clientMessage: "You must be signed in to use this route",
        });
      }

      stdReply(reply, {
        clientMessage: "Locked page: " + user.id,
      });
    }
  );
}
