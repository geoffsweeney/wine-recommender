import { z } from 'zod';

export const PreferenceNodeSchema = z.object({
  type: z.string().min(1, 'Preference type is required'),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
  source: z.string().min(1, 'Preference source is required'),
  confidence: z.number().min(0).max(1).optional(),
  timestamp: z.number(), // Assuming timestamp is a number (e.g., Date.now())
  active: z.boolean(),
  negated: z.boolean().optional(),
});

export const UserPreferencesUpdateSchema = z.array(PreferenceNodeSchema);

export type UserPreferencesUpdate = z.infer<typeof UserPreferencesUpdateSchema>;