import { z } from 'zod';

export const AdminCommandRequestSchema = z.object({
  userId: z.string().uuid(),
  input: z.object({
    message: z.string(),
  }),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

export type AdminCommandRequest = z.infer<typeof AdminCommandRequestSchema>;