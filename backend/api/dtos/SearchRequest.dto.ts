import { z } from 'zod';

// Define the input type for the schema, reflecting the expected query parameter types (strings)
const SearchRequestInput = z.object({
  query: z.string().or(z.object({
    name: z.string().optional(),
    type: z.string().optional()
  })),
  limit: z.string().optional(),
  offset: z.string().optional(),
  region: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  page: z.string().optional()
});

// Define the output type for the schema, reflecting the desired parsed types
const SearchRequestOutput = z.object({
  query: z.object({
    name: z.string().optional(),
    type: z.string().optional()
  }).or(z.string().min(1, 'Search query is required')),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
  region: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  page: z.number().int().min(1).default(1)
});

// Combine input and output types with transformations
export const SearchRequest = SearchRequestInput.transform((data) => ({
  query: data.query,
  limit: data.limit !== undefined ? parseInt(data.limit, 10) : undefined,
  offset: data.offset !== undefined ? parseInt(data.offset, 10) : undefined,
  region: data.region,
  minPrice: data.minPrice !== undefined ? parseFloat(data.minPrice) : undefined,
  maxPrice: data.maxPrice !== undefined ? parseFloat(data.maxPrice) : undefined,
  page: data.page !== undefined ? parseInt(data.page, 10) : undefined
})).pipe(SearchRequestOutput); // Pipe the transformed data into the output schema for validation and defaults


export type SearchRequest = z.infer<typeof SearchRequestOutput>;