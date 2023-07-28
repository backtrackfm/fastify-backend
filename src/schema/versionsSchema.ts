import { z } from "zod";
import { STD_STRING } from "./schemaUtils";

export const createVersionSchema = z.object({
  name: STD_STRING,
  tags: STD_STRING.array(),
  description: STD_STRING.optional(),
  projectFilesURL: STD_STRING, // A URL to download the .als files
});
