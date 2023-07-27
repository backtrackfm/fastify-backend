import { z } from "zod";
import { STD_STRING } from "./schemaUtils";

export const createBranchSchema = z.object({
  name: STD_STRING,
  description: STD_STRING.optional(),
});
