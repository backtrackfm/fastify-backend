import { FastifyInstance, RouteOptions } from "fastify";
import { stdNoAuth, stdReply } from "../../lib/std-reply";
import { editUserSchema, signUpSchema } from "../../schema/usersSchema";
import bcrypt from "bcrypt";
import { redirectToLogin } from "../../lib/auth";

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

  // DELETE A USER
  fastify.delete(
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

      // Delete user
      await fastify.prisma.user.delete({
        where: {
          id: user.id,
        },
      });

      stdReply(reply, {
        data: {
          user: {
            id: user.id,
          },
        },
        clientMessage: `Successfully deleted user ${user.id}`,
      });
    }
  );

  // UPDATE A USER
  fastify.patch(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const details = await editUserSchema.parseAsync(request.body);

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      // Validate this user's password with the password provided
      const passwordMatch = await bcrypt.compare(
        details.password,
        request.user.password
      );

      if (!passwordMatch) {
        return stdReply(reply, {
          clientMessage: "Password doesn't match your current password",
          error: {
            type: "validation",
            code: 400,
            details:
              "The field 'password' provided does not match the user's password",
          },
        });
      }

      const { password, newPassword, ...rest } = details;

      // Update user
      const updatedUser = await fastify.prisma.user.update({
        where: {
          id: request.user.id,
        },
        data: {
          ...rest,
          password: newPassword,
        },
      });

      const { password: _, ...updatedUserDetails } = updatedUser;

      return stdReply(reply, {
        data: updatedUserDetails,
        clientMessage: "Success! Updated user details",
      });
    }
  );
}

module.exports = routes;
