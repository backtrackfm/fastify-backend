import passport from "@fastify/passport";
import { FastifyInstance, RouteOptions } from "fastify";
import { loginPageRoute } from "../../lib/consts";

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  fastify.get(
    "/",
    {
      preValidation: passport.authenticate("local", {
        failureRedirect: loginPageRoute, // sends us to login html page
      }),
    },
    async (request, reply) => {
      reply.send("Login");
    }
  );
}
