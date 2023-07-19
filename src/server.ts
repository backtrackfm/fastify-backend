import fastify, { errorCodes } from "fastify";
import * as dotenv from "dotenv";
import autoload from "@fastify/autoload";
import path from "path";
import { env } from "./lib/env";
// import fastifySecureSession from "@fastify/secure-session";
import fastifyPassport from "@fastify/passport";
import bcrypt from "bcrypt";
import fs from "fs";
import { ZodError } from "zod";
import { stdReply } from "./lib/std-reply";
import fastifyPrismaClient from "fastify-prisma-client";
import { fastifySecureSession } from "@fastify/secure-session";
import passportLocal from "passport-local";
import { User } from "@prisma/client";
import fastifyFormbody from "@fastify/formbody";

const app = fastify();
dotenv.config({
  path: path.join(__dirname, "..", ".env"),
});

// app.register(fastifySecureSession, {
//   key: fs.readFileSync(path.join(__dirname, "../example-key")),
// });

app.register(fastifyPrismaClient);
app.register(fastifyFormbody);

// fastifyPassport.use(
//   new LocalStrategy.Strategy(async (username, password, done) => {
//     let attemptedUser;

//     try {
//       attemptedUser = await app.prisma.user.findFirst({
//         where: {
//           email: username,
//         },
//       });
//     } catch (e) {
//       return done(e);
//     }

//     if (!attemptedUser) {
//       return done(null, false);
//     }

//     if (bcrypt.compareSync(password, attemptedUser.password)) {
//       return done(null, false);
//     }

//     return done(null, attemptedUser);
//   })
// );

// Sessions
app.register(fastifySecureSession, {
  key: fs.readFileSync(path.join(__dirname, "../example-key")),
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
      const user = await app.prisma.user.findFirst({
        where: {
          email,
        },
      });

      if (!user) {
        return cb("User with this email doesn't exist");
      }

      const isCorrectPassword = await bcrypt.compare(password, user.password);

      if (!isCorrectPassword) {
        return cb("Incorrect password");
      }

      // null and false for all other cases
      return cb(null, user);
    }
  )
);

// register a serializer that stores the user object's id in the session ...
fastifyPassport.registerUserSerializer<User, string>(async (user, request) => {
  console.log(user);
  return user.id;
});

// ... and then a deserializer that will fetch that user from the database when a request with an id in the session arrives

// TODO: what is unknown??
fastifyPassport.registerUserDeserializer<string, unknown>(
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
