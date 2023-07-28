import { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../../../../../../lib/auth";
import {
  stdNoAuth,
  stdNoMultipart,
  stdReply,
} from "../../../../../../../../lib/std-reply";
import { MultipartFile } from "@fastify/multipart";
import { createPreviewSchema } from "../../../../../../../../schema/versionsSchema";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../../../../../../../../server";
import { getObjectURL } from "../../../../../../../../lib/bucket-helpers";

type RouteParams = {
  versionName: string;
  branchName: string;
  projectId: string;
};

type FileWithBuffer = {
  file: MultipartFile;
  buffer: Buffer;
};

// Decodes the branchName & versionNae for us
function parseParams(request: FastifyRequest): RouteParams {
  const {
    versionName: rawVersionName,
    branchName: rawBranchName,
    projectId,
  } = request.params as RouteParams;

  return {
    branchName: decodeURIComponent(rawBranchName).toLowerCase(),
    projectId,
    versionName: decodeURIComponent(rawVersionName).toLowerCase(),
  };
}

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
      const { branchName, versionName, projectId } = parseParams(request);

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      if (!request.isMultipart()) {
        return stdReply(reply, stdNoMultipart);
      }

      const version = await fastify.prisma.version.findFirst({
        where: {
          AND: {
            branchName,
            name: versionName,
            projectId,
          },
        },
        include: {
          branch: {
            include: {
              project: true,
            },
          },
          previews: true,
        },
      });

      if (!version) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "not-found",
          },
          clientMessage: `Version ${versionName} on branch ${branchName} in project ${projectId} not found`,
        });
      }

      // Only the owner of the project can create previews
      if (version.branch.project.createdByUserId !== request.user.id) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "auth",
            details: `${request.user.id} !== ${version.branch.project.createdByUserId}`,
          },
          clientMessage:
            "You can only add previews to versions on your own branches",
        });
      }

      // Read parts

      const parts = request.parts();
      let rawTextDetails: any = {};
      const fileBufferParts: FileWithBuffer[] = [];
      let toSearchFieldnames = ["preview"];
      const originalSearchSize = toSearchFieldnames.length;

      for await (const part of parts) {
        if (part.type !== "file") {
          rawTextDetails[part.fieldname] = part.value;
        } else {
          const searchMatches = toSearchFieldnames.filter(
            (it) => it === part.fieldname
          );

          if (searchMatches.length > 0) {
            fileBufferParts.push({
              buffer: await part.toBuffer(),
              file: part,
            });

            // Now we're done searching, so remove from array
            toSearchFieldnames = toSearchFieldnames.filter(
              (it) => it === part.fieldname
            );
          } else {
            // Note: we MUST consume all parts
            // TODO: Can we do something better?
            // From: https://github.com/fastify/fastify-multipart
            await part.toBuffer();
          }
        }
      }

      // Ensure enough fileParts
      if (fileBufferParts.length !== originalSearchSize) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "validation",
            details: `Looking for file fields: ${toSearchFieldnames}`,
          },
          clientMessage: `Only ${fileBufferParts.length}/${originalSearchSize} files provided`,
        });
      }

      // zod parse these text details
      let details = await createPreviewSchema.parseAsync(rawTextDetails);

      const preview = await fastify.prisma.preview.create({
        data: {
          ...details,
          version: {
            connect: {
              name_branchName_projectId: {
                name: versionName,
                branchName,
                projectId,
              },
            },
          },
        },
      });

      let replyDetails = preview;

      // Now upload file to s3
      fileBufferParts.forEach(async ({ file, buffer }) => {
        // TODO: TS gives weird error saying request.user can be undefined.
        if (!request.user) {
          return stdReply(reply, stdNoAuth);
        }

        const filename = file.filename;
        const extension = filename.slice(filename.lastIndexOf("."));
        const path = `${request.user.id}/${projectId}/${branchName}/${branchName}/projectFiles${extension}`;

        const putObjectCommand = new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET,
          Key: path,
          Body: buffer,
          ContentType: file.mimetype,
        });

        await s3.send(putObjectCommand);

        // Now get the URL of this newly created object
        const url = getObjectURL(path);

        // And update the createdProject
        replyDetails = await fastify.prisma.preview.update({
          where: {
            id: preview.id,
          },
          data: {
            fileURL: url,
            updatedAt: new Date(),
          },
        });
      });

      return stdReply(reply, {
        data: replyDetails,
        clientMessage: `Success! Created preview ${preview.title}`,
      });
    }
  );
}
