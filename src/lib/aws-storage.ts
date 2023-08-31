// S3 storage bucket helpers

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  ObjectIdentifier,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../server";

/**
 * Gets a signed URL for S3. This allows a user to view the file object
 * @param path Object path in S3
 * @returns The URL
 */
export async function getSignedObjectURL(path: string) {
  const tick = new Date();

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: path,
  });

  const url = await getSignedUrl(s3, command, {
    expiresIn: 60 * 15,
  });

  const tock = new Date();

  console.log(`Operation took ${tock.getTime() - tick.getTime()}ms`);

  return url;
}

/**
 * Gets a URL for S3. This allows a user to view the file object if its public
 * @param key Object key in S3
 * @returns The URL
 */
export function getPublicObjectURL(key: string) {
  return `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Uploads a file to S3
 * @param file The file to upload
 * @param file The content type of the file
 * @param path The path this file should go to
 */
export async function uploadFile(
  file: Buffer | undefined,
  contentType: string,
  path: string
) {
  // const arrayBuffer = await file.arrayBuffer();
  // const byteArray = new Uint8Array(arrayBuffer);

  const putObjectCommand = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: path,
    Body: file,
    ContentType: contentType,
  });

  await s3.send(putObjectCommand);
}

/**
 * Essentially takes the extension from the first param, and adds it to the second parameter
 * @param ogNameWithExt The total filename, like tika.zip
 * @param newName The new NAME, like bob
 * @returns The new filename and extension, like bob.zip
 */
export function addExtension(ogNameWithExt: string, newName: string) {
  const extension = ogNameWithExt.slice(ogNameWithExt.lastIndexOf("."));
  const name = `${newName}${extension}`;
  return name;
}

/**
 * Deletes a file in S3
 * @param path The path of the file to delete
 */
export async function deleteFile(path: string) {
  const deleteObjectCommand = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: path,
  });

  await s3.send(deleteObjectCommand);
}

/**
 * Renames a file in AWS by copying the file to the new path and deleting the old one
 * @param path The path of the file to rename
 * @param newPath The new path
 */
export async function renameFile(path: string, newPath: string) {
  // NOTE: this doesn't work

  try {
    const copyObjectCommand = new CopyObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: newPath,
      CopySource: `${process.env.AWS_BUCKET}/${path}`,
    });

    // Copy the file
    await s3.send(copyObjectCommand);

    // Now we can delete the old one
    deleteFile(path);
  } catch (e) {
    return false;
  }
}

// You must recursively delete objects in a folder in S3: https://stackoverflow.com/questions/20207063/how-can-i-delete-folder-on-s3-with-node-js
export async function deleteFolder(path: string) {
  try {
    const listObjectsCommand = new ListObjectsV2Command({
      Bucket: process.env.AWS_BUCKET,
      Prefix: path,
    });

    const listedObjects = await s3.send(listObjectsCommand);

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) return;

    const objects: ObjectIdentifier[] = [];

    listedObjects.Contents.forEach(({ Key }) => {
      objects.push({ Key });
    });

    const deleteObjectsCommand = new DeleteObjectsCommand({
      Bucket: process.env.AWS_BUCKET,
      Delete: {
        Objects: objects,
      },
    });

    await s3.send(deleteObjectsCommand);

    if (listedObjects.IsTruncated) await deleteFolder(path);
  } catch (e) {
    return false;
  }
}
