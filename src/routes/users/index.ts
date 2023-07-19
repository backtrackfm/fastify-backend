import { FastifyInstance, RouteOptions } from "fastify";
import { stdReply } from "../../lib/std-reply";
import { signUpSchema } from "../../schema/usersSchema";
import bcrypt from "bcrypt";

async function routes(fastify: FastifyInstance, options: RouteOptions) {
  // CREATE A USER (SIGN UP)
  fastify.post("/", async (request, reply) => {
    const details = await signUpSchema.parseAsync(request.body);

    // See if this user already exists
    const maybeConflictUser = await fastify.prisma.user.findFirst({
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

    const user = await fastify.prisma.user.create({
      data: {
        ...details,
        password: hashedPassword,
      },
    });

    const tokenPayload = {
      id: user.id,
      email: user.email,
    };

    request.login(tokenPayload, {
      session: true,
    });

    // All's well!
    return stdReply(reply, {
      clientMessage: "Success! User signed up",
      data: tokenPayload,
    });
  });
}

module.exports = routes;
