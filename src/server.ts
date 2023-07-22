import fastify from "fastify";
import * as dotenv from "dotenv";
import autoload from "@fastify/autoload";
import path from "path";
import { env } from "./lib/env";
import fastifyPassport from "@fastify/passport";
import bcrypt from "bcrypt";
import fs from "fs";
import { ZodError } from "zod";
import { StdReply, isStdReply, stdReply } from "./lib/std-reply";
import fastifyPrismaClient from "fastify-prisma-client";
import { fastifySecureSession } from "@fastify/secure-session";
import passportLocal from "passport-local";
import { User } from "@prisma/client";
import fastifyFormbody from "@fastify/formbody";
import "./global";

const app = fastify();
dotenv.config({
  path: path.join(__dirname, "..", ".env"),
});

app.register(fastifyPrismaClient);
app.register(fastifyFormbody);

// Sessions
app.register(fastifySecureSession, {
  // the name of the attribute decorated on the request-object, defaults to 'session'
  sessionName: "session",
  // the name of the session cookie, defaults to value of sessionName
  cookieName: "auth-session-cookie",
  key: fs.readFileSync(path.join(__dirname, "../secret_key")),
  cookie: {
    path: "/",
    // options for setCookie, see https://github.com/fastify/fastify-cookie
  },
});

app.register(fastifyPassport.initialize());
app.register(fastifyPassport.secureSession());

// On login
fastifyPassport.use(
  new passportLocal.Strategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    // login method
    async (email, password, cb) => {
      function err(stdError: StdReply) {
        cb(stdError);
      }

      const user = await app.prisma.user.findFirst({
        where: {
          email,
        },
      });

      if (!user) {
        return err({
          clientMessage: "User with this email doesn't exist",
          error: {
            type: "not-found",
            code: 400,
          },
        });
      }

      const isCorrectPassword = await bcrypt.compare(password, user.password);

      if (!isCorrectPassword) {
        return err({
          error: {
            code: 400,
            type: "validation",
          },
          clientMessage: "Incorrect password",
        });
      }

      // null and false for all other cases
      return cb(null, user);
    }
  )
);

// register a serializer that stores the user object's id in the session ...
fastifyPassport.registerUserSerializer<User, string>(
  async (user, request) => user.id
);

// ... and then a deserializer that will fetch that user from the database when a request with an id in the session arrives
fastifyPassport.registerUserDeserializer<string, User | null>(
  async (id, request) => {
    return await app.prisma.user.findFirst({
      where: {
        id,
      },
    });
  }
);

const port = env.PORT || 4000;

app.setErrorHandler(function (error, request, reply) {
  if (error instanceof ZodError) {
    const issueMap = error.issues.map((it) => {
      return {
        field: it.path.join(" "),
        issue: it.message,
      };
    });

    return stdReply(reply, {
      error: {
        code: 400,
        details: issueMap,
        type: "validation",
      },
      clientMessage: "Invalid form input",
    });
  }

  // if error is a StdReply
  if (isStdReply(error)) {
    return stdReply(reply, error);
  }

  console.log(error);

  return stdReply(reply, {
    error: {
      code: 500,
      details: null,
      type: "unknown",
    },
    clientMessage: "Something went wrong",
  });
});

// Register plugins
app.register(autoload, {
  dir: path.join(__dirname, "routes"),
  dirNameRoutePrefix: true, // lack of prefix will mean no prefix, instead of directory name
  routeParams: true,
  options: {
    prefix: env.API_PREFIX,
  },
});

app.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  console.log(`🛠 Server listening at ${address}`);
});
