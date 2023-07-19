import passport from "@fastify/passport";
import { FastifyInstance, RouteOptions } from "fastify";
import { loginPageRoute } from "../../../lib/consts";

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  fastify.post(
    "/",
    {
      preValidation: passport.authenticate("local", {
        successReturnToOrRedirect: "/api/locked",
        failureRedirect: loginPageRoute,
        failureMessage: true,
        session: true,
      }),
    },
    async (request, reply) => {
      reply.send("Login");
    }
  );
}
