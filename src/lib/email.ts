import { z } from "zod";

/** Allows local/dev hosts such as manager@ruledeck.local */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(320)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
