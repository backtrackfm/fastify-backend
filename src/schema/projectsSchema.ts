import { z } from "zod";
import { STD_STRING } from "./schemaUtils";

const STRING_ARRAY = z
  .string()
  .min(1)
  .refine(
    (value) => {
      try {
        const parsedValue = JSON.parse(value);
        return (
          Array.isArray(parsedValue) &&
          parsedValue.every((item) => typeof item === "string")
        );
      } catch {
        return false;
      }
    },
    {
      message: "Invalid JSON-formatted string array",
    }
  )
  .transform<string[]>((value) => {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error("Failed to parse JSON-formatted string array");
    }
  });

export const createProjectSchema = z.object({
  genre: STD_STRING,
  name: STD_STRING,
  tags: STRING_ARRAY, // would be just be array but fd doesn't allow anything other than strings.
  description: STD_STRING.optional(),
});

export const updateProjectSchema = z.object({
  genre: STD_STRING.optional(),
  name: STD_STRING.optional(),
  tags: STRING_ARRAY.optional(),
  description: STD_STRING.optional(),
});
