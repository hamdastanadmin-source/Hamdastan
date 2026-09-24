/**
 * Credentials shape. The login form and the backend auth module validate
 * against the same schema — the error messages below are what the user sees.
 */

import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'نام کاربری الزامی است'),
  password: z.string().min(1, 'رمز عبور الزامی است'),
});

export type LoginInput = z.infer<typeof loginSchema>;
