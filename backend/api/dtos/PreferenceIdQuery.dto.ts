import { z } from 'zod';

export const PreferenceIdQuerySchema = z.object({
  preferenceId: z.string().min(1, 'Preference ID is required').optional(),
});

export type PreferenceIdQuery = z.infer<typeof PreferenceIdQuerySchema>;