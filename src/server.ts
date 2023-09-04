import { S3Client } from "@aws-sdk/client-s3";
import autoload from "@fastify/autoload";
import cors from "@fastify/cors";
import fastifyFormbody from "@fastify/formbody";
import fastifyMultipart from "@fastify/multipart";
import fastifyPassport from "@fastify/passport";
import { fastifySecureSession } from "@fastify/secure-session";
import { User } from "@prisma/client";
import bcrypt from "bcrypt";
import * as dotenv from "dotenv";
import fastify from "fastify";
import fs from "fs";
import passportLocal from "passport-local";
import path from "path";
import { pipeline } from "stream";
import util from "util";
import { ZodError } from "zod";
import prismaPlugin from "./lib/prisma";
import { StdReply, isStdReply, stdReply } from "./lib/std-reply";

declare module "fastify" {
  interface PassportUser extends User {}
}

export const pump = util.promisify(pipeline);

const app = fastify();

// read .env file with configuration
dotenv.config({});

// create s3 client using your credentials
export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY as string,
    secretAccessKey: process.env.AWS_SECRET_KEY as string,
  },
});

app.register(prismaPlugin);
app.register(fastifyFormbody);
app.register(fastifyMultipart);
app.register(cors, {
  origin: ["http://localhost:8888", "app://"],
  credentials: true,
});

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
app.register(fastifyPassport.secureSession({}));

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

const port = process.env.PORT || 4000;

app.setErrorHandler(function (error, request, reply) {
  console.log(error);

  if (error instanceof ZodError) {
    if (!request.isMultipart() && !request.body) {
      return stdReply(reply, {
        error: {
          code: 400,
          type: "validation",
        },
        clientMessage: "No body provided",
      });
    }

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

  // Multipart errors
  if (error instanceof this.multipartErrors.RequestFileTooLargeError) {
    return stdReply(reply, {
      error: {
        code: 400,
        type: "validation",
      },
      clientMessage: "File is too large",
    });
  }

  if (error instanceof this.multipartErrors.InvalidMultipartContentTypeError) {
    return stdReply(reply, {
      error: {
        code: 400,
        type: "validation",
      },
      clientMessage: "No body of type multipart/form-data provided",
    });
  }

  if (isStdReply(error)) {
    // if error is a StdReply
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
    prefix: process.env.API_PREFIX,
  },
});

app.listen({ port: port as number, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🛠 Server listening at ${address}`);
});
