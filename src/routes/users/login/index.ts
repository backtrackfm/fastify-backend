import passport from "@fastify/passport";
import { FastifyInstance, RouteOptions } from "fastify";

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
      reply.send("Login");
    }
  );
}
