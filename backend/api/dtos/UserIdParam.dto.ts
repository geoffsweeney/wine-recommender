import { z } from 'zod';

export const UserIdParamSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export type UserIdParam = z.infer<typeof UserIdParamSchema>;