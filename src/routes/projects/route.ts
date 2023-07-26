import { FastifyInstance, RouteOptions } from "fastify";
import { redirectToLogin } from "../../lib/auth";
import { createProjectSchema } from "../../schema/projectsSchema";
import { s3 } from "../../server";
import { MultipartFile } from "@fastify/multipart";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { stdReply } from "../../lib/std-reply";

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
      let coverArtPart: MultipartFile | undefined;
      let coverArtBuffer;

      for await (const part of parts) {
        if (part.type !== "file") {
          rawTextDetails[part.fieldname] = part.value;
        } else {
          if (part.fieldname === coverArtFieldname) {
            coverArtPart = part;
            coverArtBuffer = await part.toBuffer();
          } else {
            // Can we do something better?
            // Note: we MUST consume all parts
            // From: https://github.com/fastify/fastify-multipart
            await part.toBuffer();
          }
        }
      }

      // zod parse these text details
      const details = await createProjectSchema.parseAsync(rawTextDetails);

      // If there's a cover art, upload it to the cloud
      if (coverArtPart) {
        const putObjectCommand = new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET,
          Key: coverArtPart.filename,
          Body: coverArtBuffer,
          ContentType: coverArtPart.mimetype,
        });

        await s3.send(putObjectCommand);
      }

      stdReply(reply, {
        data: details,
        clientMessage: `Created project ${details.name}`,
      });
    }
  );
}
