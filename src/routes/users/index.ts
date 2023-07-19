import { FastifyInstance, RouteOptions } from "fastify";
import { stdReply } from "../../lib/std-reply";
import { signUpSchema } from "../../schema/usersSchema";
import { prisma } from "../../lib/prisma";
import bcrypt, { hash } from "bcrypt";
import { UserType } from "@prisma/client";
import passport from "@fastify/passport";

async function routes(fastify: FastifyInstance, options: RouteOptions) {
  // CREATE A USER (SIGN UP)
  fastify.post("/", async (request, reply) => {
    const details = await signUpSchema.parseAsync(request.body);

    // See if this user already exists
    const maybeConflictUser = await prisma.user.findFirst({
      where: {
        email: details.email,
      },
    });

    if (maybeConflictUser) {
      return stdReply(reply, {
        error: {
          code: 400,
          type: "conflict",
        },
        clientMessage: "A user with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(details.password, 10);

    const { id, ...user } = await prisma.user.create({
      data: {
        ...details,
        password: hashedPassword,
      },
    });

    // All's well!
    return stdReply(reply, {
      clientMessage: "Success! User signed up",
      data: id,
    });
  });
}

module.exports = routes;
