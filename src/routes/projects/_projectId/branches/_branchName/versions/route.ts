import { MultipartFile } from "@fastify/multipart";
import { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import { redirectToLogin } from "../../../../../../lib/auth";
import {
  getSignedObjectURL,
  uploadFile,
} from "../../../../../../lib/aws-storage";
import { processFileParts } from "../../../../../../lib/multipart-utils";
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

      const { body, files } = await processFileParts(parts, ["projectFiles"]);

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
      const projectFiles = files["projectFiles"];

      const filename = projectFiles.file.filename;
      const extension = projectFiles.file.filename.slice(
        filename.lastIndexOf(".")
      );
      const path = `${request.user.id}/${projectId}/${branchName}/${replyDetails.name}/projectFiles${extension}`;

      console.log(filename);

      // Upload the file to s3
      await uploadFile(projectFiles.buffer, projectFiles.file.mimetype, path);

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

      return stdReply(reply, {
        data: { ...replyDetails, url },
        clientMessage: `Success! Created version ${version.name}`,
      });
    }
  );
}
