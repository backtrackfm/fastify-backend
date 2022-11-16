import fastify from "fastify";
import * as dotenv from "dotenv";
import autoload from "@fastify/autoload";
import path from "path";
import { env } from "./lib/env";
import { PrismaClient } from "@prisma/client";

const app = fastify();
dotenv.config({
  path: path.join(__dirname, "..", ".env.local"),
});

const port = env.PORT || 4000;
export const db = new PrismaClient();

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
