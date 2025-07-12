import { z } from 'zod';

export const DeletePreferenceQuerySchema = z.object({
  preferenceId: z.string().min(1, 'Preference ID is required').optional(),
  type: z.string().min(1, 'Preference type is required').optional(),
  value: z.string().min(1, 'Preference value is required').optional(),
}).refine(data => {
  // If no fields are provided, it's valid for "delete all preferences"
  if (!data.preferenceId && !data.type && !data.value) {
    return true;
  }
  // Otherwise, apply the original validation logic
  return data.preferenceId || (data.type && data.value);
}, {
  message: "Either 'preferenceId' or both 'type' and 'value' must be provided, or no parameters for deleting all preferences.",
  path: ['preferenceId', 'type', 'value'],
});

export type DeletePreferenceQuery = z.infer<typeof DeletePreferenceQuerySchema>;