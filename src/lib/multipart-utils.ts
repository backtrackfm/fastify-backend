import { Multipart, MultipartFile } from "@fastify/multipart";

type KeyOfUnion<T> = T extends any ? keyof T : never;

/**
 * Given multipart parts
 */
export async function processFileParts<U = any>(
  parts: AsyncIterableIterator<Multipart>,
  fileFields: string[]
) {
  const files: Record<
    string,
    {
      file: MultipartFile;
      buffer: Buffer;
    }
  > = {} as any;
  let body: U | undefined;

  for await (const part of parts) {
    if (part.type === "file") {
      if (fileFields.includes(part.fieldname)) {
        files[part.fieldname] = {
          file: part,
          buffer: await part.toBuffer(),
        };
      } else {
        // Can we do something better?
        // Note: we MUST consume all parts
        // From: https://github.com/fastify/fastify-multipart
        await part.toBuffer();
      }
    } else {
      if (part.fieldname === "body") {
        body = JSON.parse(part.value as string); // must be a string, this is ok.
      }
    }
  }

  return {
    files,
    body,
  };
}
