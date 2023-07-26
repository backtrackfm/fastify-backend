import { FastifyInstance, RouteOptions } from "fastify";
import { redirectToLogin } from "../../lib/auth";
import { createProjectSchema } from "../../schema/projectsSchema";
import { pump, s3 } from "../../server";
import fs from "fs";
import { MultipartFile } from "@fastify/multipart";
import { PutObjectCommand } from "@aws-sdk/client-s3";

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
      const parts = request.parts();
      let rawTextDetails: any = {};
      const coverArtFieldname = "coverArt";
      // let coverArtPart: MultipartFile | undefined;

      for await (const part of parts) {
        if (part.type !== "file") {
          rawTextDetails[part.fieldname] = part.value;
        } else {
          if (part.fieldname === coverArtFieldname) {
            const coverArt = part;

            const putObjectCommand = new PutObjectCommand({
              Bucket: process.env.AWS_BUCKET,
              Key: coverArt.filename,
              Body: await coverArt.toBuffer(),
              ContentType: coverArt.mimetype,
            });

            await s3.send(putObjectCommand);
          }
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
