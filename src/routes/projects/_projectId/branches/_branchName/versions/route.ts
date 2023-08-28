import { MultipartFile } from "@fastify/multipart";
import { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../../../../lib/auth";
import {
  getSignedObjectURL,
  uploadFile,
} from "../../../../../../lib/aws-storage";
import {
  stdNoAuth,
  stdNoMultipart,
  stdReply,
} from "../../../../../../lib/std-reply";
import { createVersionSchema } from "../../../../../../schema/versionsSchema";

type RouteParams = {
  branchName: string;
  projectId: string;
};

type FileWithBuffer = {
  file: MultipartFile;
  buffer: Buffer;
};

// Decodes the branchName for us
function parseParams(request: FastifyRequest) {
  const { branchName: rawBranchName, projectId } =
    request.params as RouteParams;

  return {
    branchName: decodeURIComponent(rawBranchName).toLowerCase(),
    projectId,
  };
}

export default async function routes(
  fastify: FastifyInstance,
  options: RouteOptions
) {
  fastify.get(
    "/latest",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const { branchName, projectId } = parseParams(request);

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      // get latest version
      const version = await fastify.prisma.version.findFirst({
        where: {
          AND: {
            projectId,
            branchName,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!version) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "not-found",
          },
          clientMessage: `Latest version on branch ${branchName} in project ${projectId} not found`,
        });
      }

      return stdReply(reply, {
        data: version,
      });
    }
  );

  fastify.get(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const { branchName, projectId } = parseParams(request);

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const versions = await fastify.prisma.version.findMany({
        where: {
          AND: {
            branchName,
            projectId,
          },
        },
        include: {
          branch: {
            include: {
              project: {
                select: {
                  createdByUserId: true,
                },
              },
            },
          },
          previews: true,
        },
      });

      if (!versions || versions.length < 1) {
        return stdReply(reply, {
          data: [],
          clientMessage: `Found 0 versions on branch ${branchName} in project ${projectId}`,
        });
      }

      const projectOwner = versions[0].branch.project.createdByUserId;

      if (projectOwner !== request.user.id) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "auth",
            details: `${request.user.id} !== ${projectOwner}`,
          },
          clientMessage:
            "You can only get versions on your own branches/projects",
        });
      }

      const replyDetails = versions.map((it) => {
        const { branch, ...a } = it;

        return a;
      });

      const promises = replyDetails.map(async (it) => {
        return {
          ...it,
          filesURL: it.filesStoragePath
            ? await getSignedObjectURL(it.filesStoragePath)
            : undefined,
          previews: await Promise.all(
            it.previews.map(async (p) => {
              return {
                ...p,
                fileURL: p.storagePath
                  ? await getSignedObjectURL(p.storagePath)
                  : undefined,
              };
            })
          ),
        };
      });

      const versionsWithURLs = await Promise.all(promises);

      return stdReply(reply, {
        data: versionsWithURLs,
        clientMessage: `Found ${replyDetails.length} versions on branch ${branchName} in project ${projectId}`,
      });
    }
  );

  fastify.post(
    "/",
    {
      preValidation: (request, reply) => redirectToLogin(request, reply),
    },
    async (request, reply) => {
      const { branchName, projectId } = parseParams(request);

      if (!request.isMultipart()) {
        return stdReply(reply, stdNoMultipart);
      }

      if (!request.user) {
        return stdReply(reply, stdNoAuth);
      }

      const parts = request.parts({
        limits: {
          fileSize: 300000000, // NB: ~ 300mb
        },
      });
      let rawTextDetails: any = {};
      const fileBufferParts: FileWithBuffer[] = [];
      let toSearchFieldnames = ["projectFiles"];
      const originalSearchSize = toSearchFieldnames.length;
      let body;

      for await (const part of parts) {
        if (part.type === "file") {
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
        } else {
          if (part.fieldname === "body") {
            body = JSON.parse(part.value as string); // must be a string, this is ok.
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
      let details = await createVersionSchema.parseAsync(body);

      details.name = details.name.toLowerCase();

      const branch = await fastify.prisma.branch.findFirst({
        where: {
          AND: {
            projectId,
            name: branchName,
          },
        },
        include: {
          versions: true,
          project: true,
        },
      });

      if (!branch) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "not-found",
          },
          clientMessage: `Branch ${branchName} not found`,
        });
      }

      // Ensure no duplicate versions
      const versionDuplicates = branch.versions.filter(
        (it) => it.name.toLowerCase() === details.name
      );

      if (versionDuplicates.length > 0) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "conflict",
          },
          clientMessage: `You already have a version called ${details.name} on this project`,
        });
      }

      // For now, can only create versions on your own projects
      if (branch.project.createdByUserId !== request.user.id) {
        return stdReply(reply, {
          error: {
            code: 400,
            type: "auth",
            details: `${request.user.id} !== ${branch.project.createdByUserId}`,
          },
          clientMessage: "You can only create versions on your own branches",
        });
      }

      // We need version to upload to S3, so create then update
      const version = await fastify.prisma.version.create({
        data: {
          ...details,
          branch: {
            connect: {
              name_projectId: {
                name: branchName,
                projectId,
              },
            },
          },
        },
      });

      let replyDetails = version;
      // TODO: only one version
      let url = "";

      // Now upload file zip to s3
      for (let i = 0; i < fileBufferParts.length; i++) {
        const { file, buffer } = fileBufferParts[i];

        // TODO: TS gives weird error saying request.user can be undefined.
        if (!request.user) {
          return stdReply(reply, stdNoAuth);
        }

        const filename = file.filename;
        const extension = filename.slice(filename.lastIndexOf("."));
        const path = `${request.user.id}/${projectId}/${branchName}/${replyDetails.name}/projectFiles${extension}`;

        console.log(filename);

        // Upload the file to s3
        await uploadFile(buffer, file.mimetype, path);

        url = await getSignedObjectURL(path);

        // And update the createdProject
        replyDetails = await fastify.prisma.version.update({
          where: {
            name_branchName_projectId: {
              branchName,
              projectId,
              name: details.name,
            },
          },
          data: {
            filesStoragePath: path,
            updatedAt: new Date(),
          },
        });
      }

      return stdReply(reply, {
        data: { ...replyDetails, url },
        clientMessage: `Success! Created version ${version.name}`,
      });
    }
  );
}
