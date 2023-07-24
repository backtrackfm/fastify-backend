import { z } from "zod";

const STD_STRING = z.string().min(3);
const PASSWORD = z.string().min(6);

export const signUpSchema = z.object({
  email: STD_STRING.email(),
  name: STD_STRING.max(16),
  password: PASSWORD,
  type: z.enum(["ARTIST", "PRODUCER", "ENGINEER"]).default("ARTIST"),
});

export const editUserSchema = z.object({
  password: PASSWORD,
  email: STD_STRING.email().optional(),
  name: STD_STRING.max(16).optional(),
  newPassword: PASSWORD.optional(),
  type: z.enum(["ARTIST", "PRODUCER", "ENGINEER"]).default("ARTIST"),
});
