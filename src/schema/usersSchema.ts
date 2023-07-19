import { z } from "zod";

const STD_STRING = z.string().min(3);
const PASSWORD = z.string().min(6);

export const signUpSchema = z.object({
  email: STD_STRING.email(),
  name: STD_STRING.max(16),
  password: PASSWORD,
  type: z.enum(["Artist", "Producer", "Engineer"]).default("Artist"),
});
