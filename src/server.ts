import fastify, { errorCodes } from "fastify";
import * as dotenv from "dotenv";
import autoload from "@fastify/autoload";
import path from "path";
import { env } from "./lib/env";
import fastifySecureSession from "@fastify/secure-session";
import fastifyPassport from "@fastify/passport";
import LocalStrategy from "passport-local";
import bcrypt from "bcrypt";
import fs from "fs";
import { ZodError } from "zod";
import { stdReply } from "./lib/std-reply";
import fastifyPrismaClient from "fastify-prisma-client";

const app = fastify();
dotenv.config({
  path: path.join(__dirname, "..", ".env"),
});

app.register(fastifySecureSession, {
  key: fs.readFileSync(path.join(__dirname, "../example-key")),
});

app.register(fastifyPassport.initialize());

app.register(fastifyPassport.secureSession());

app.register(fastifyPrismaClient);

fastifyPassport.use(
  new LocalStrategy.Strategy(async (username, password, done) => {
    let attemptedUser;

    try {
      attemptedUser = await app.prisma.user.findFirst({
        where: {
          email: username,
        },
      });
    } catch (e) {
      return done(e);
    }

    if (!attemptedUser) {
      return done(null, false);
    }

    if (bcrypt.compareSync(password, attemptedUser.password)) {
      return done(null, false);
    }

    return done(null, attemptedUser);
  })
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
