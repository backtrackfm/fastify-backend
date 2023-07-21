import passport from "@fastify/passport";
import { FastifyInstance, RouteOptions } from "fastify";
import { loginPageRoute } from "../../lib/consts";
import { User } from "@prisma/client";

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
      const user = request.user as User | undefined;

      if (!user) {
        return reply.send("No user");
      }

      reply.send("Locked page: " + user.id);
    }
  );
}
