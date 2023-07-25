import { z } from "zod";

export const STD_STRING = z.string().min(3);
export const PASSWORD = z.string().min(6);
