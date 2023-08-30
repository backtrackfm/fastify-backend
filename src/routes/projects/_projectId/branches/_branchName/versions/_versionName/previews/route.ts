import { MultipartFile } from "@fastify/multipart";
import { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../../../../../../lib/auth";
import {
  getSignedObjectURL,
  uploadFile,
} from "../../../../../../../../lib/aws-storage";
import { processFileParts } from "../../../../../../../../lib/multipart-utils";
import {
  stdNoAuth,
  stdNoMultipart,
  stdReply,
} from "../../../../../../../../lib/std-reply";
import { createPreviewSchema } from "../../../../../../../../schema/versionsSchema";

type RouteParams = {
  versionName: string;
  branchName: string;
  projectId: string;
};

type FileWithBuffer = {
  file: MultipartFile;
  buffer: Buffer;
};

// Decodes the branchName & versionName for us
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
      const parts = request.parts({
        limits: {
          fileSize: 16000000,
        },
      });

      const { body, files } = await processFileParts(parts, ["preview"]);

      // zod parse these text details
      let details = await createPreviewSchema.parseAsync(body);

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
      let url = "";

      // Now upload file to s3
      const previewFile = files["preview"];

      const filename = previewFile.file.filename;
      const extension = filename.slice(filename.lastIndexOf("."));
      const path = `${request.user.id}/${projectId}/${branchName}/${versionName}/projectFiles${extension}`;

      // Upload file to s3
      await uploadFile(previewFile.buffer, previewFile.file.mimetype, path);

      // get url
      url = await getSignedObjectURL(path);

      // And update the createdProject
      replyDetails = await fastify.prisma.preview.update({
        where: {
          id: preview.id,
        },
        data: {
          storagePath: path,
          updatedAt: new Date(),
        },
      });

      return stdReply(reply, {
        data: { ...replyDetails, url },
        clientMessage: `Success! Created preview ${preview.title}`,
      });
    }
  );
}
