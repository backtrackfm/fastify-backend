import { z } from "zod";
import { STD_STRING } from "./schemaUtils";

export const createProjectSchema = z.object({
  genre: STD_STRING,
  name: STD_STRING,
  tags: z.string().min(1).optional(), // would be array but fd doesn't allow anything other than strings.
  // coverArtURL: .file().optional(),
  description: STD_STRING.optional(),
});
