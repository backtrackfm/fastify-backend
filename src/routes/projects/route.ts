import { FastifyInstance, RouteOptions } from "fastify";
import { redirectToLogin } from "../../lib/auth";
import { createProjectSchema } from "../../schema/projectsSchema";
import { stdNoAuth, stdReply } from "../../lib/std-reply";
import { pump } from "../../server";
import fs from "fs";

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  fastify.post(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      // const details = await createProjectSchema.parseAsync(request.parts());
      // if (!request.user) {
      // return stdReply(reply, stdNoAuth);
      // }

      const parts = request.parts();
      let rawTextDetails: any = {};
      const coverArtFieldname = "coverArt";

      for await (const part of parts) {
        if (part.type === "file") {
          if (part.fieldname !== coverArtFieldname) continue;

          await pump(part.file, fs.createWriteStream(part.filename));
        } else {
          rawTextDetails[part.fieldname] = part.value;
        }
      }

      // zod parse these text details
      const details = await createProjectSchema.parseAsync(rawTextDetails);

      reply.send({
        ok: details,
      });
    }
  );
}
