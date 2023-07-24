import passport from "@fastify/passport";
import { FastifyInstance, RouteOptions } from "fastify";
import { stdReply } from "../../../lib/std-reply";

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  fastify.post(
    "/",
    {
      preHandler: passport.authenticate("local"),
    },
    async (request, reply) => {
      const user = request.user;

      if (!user) {
        throw new Error(); // Something went wrong...
      }

      stdReply(reply, {
        clientMessage: `Successfully signed in as ${user.id}`,
      });
    }
  );
}
