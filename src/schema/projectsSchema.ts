import { z } from "zod";
import { STD_STRING } from "./schemaUtils";

export const createProjectSchema = z.object({
  genre: STD_STRING,
  name: STD_STRING,
  tags: z
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
    }), // would be just be array but fd doesn't allow anything other than strings.
  description: STD_STRING.optional(),
});
