import { FastifyInstance, RouteOptions } from "fastify";
import { redirectToLogin } from "../../lib/auth";
import { createProjectSchema } from "../../schema/projectsSchema";
import { s3 } from "../../server";
import { MultipartFile } from "@fastify/multipart";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { stdNoAuth, stdReply } from "../../lib/std-reply";
import { getObjectURL } from "../../lib/bucket-helpers";

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
      const user = request.user;

      if (!user) {
        return stdReply(reply, stdNoAuth);
      }

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

      // TODO: Anything else?

      const createdProject = await fastify.prisma.project.create({
        data: {
          ...details,
          createdBy: {
            connect: {
              id: user.id,
            },
          },
        },
      });

      let replyDetails = createdProject;

      // If there's a cover art, upload it to the cloud
      // Only do this if we KNOW that we have created the object as we require the ID
      if (coverArtPart) {
        const filename = coverArtPart.filename;
        const extension = filename.slice(filename.lastIndexOf("."));
        const path = `${user.id}/${createdProject.id}/coverArt${extension}`;

        const putObjectCommand = new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET,
          Key: path,
          Body: coverArtBuffer,
          ContentType: coverArtPart.mimetype,
        });

        await s3.send(putObjectCommand);

        // Now get the URL of this newly created object
        const url = getObjectURL(path);

        // And update the createdProject
        replyDetails = await fastify.prisma.project.update({
          where: {
            id: createdProject.id,
          },
          data: {
            coverArtURL: url,
          },
        });
      }

      stdReply(reply, {
        data: replyDetails,
        clientMessage: `Created project ${details.name}`,
      });
    }
  );
}
