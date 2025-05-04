import { z } from 'zod';

export const SearchRequest = z.object({
  query: z.string().min(1, 'Search query is required'),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
  region: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  page: z.number().int().min(1).default(1)
});

export type SearchRequest = z.infer<typeof SearchRequest>;