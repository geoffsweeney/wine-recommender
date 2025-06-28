import { z } from 'zod';
 
interface OllamaStructuredClientOptions {
  host?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  numPredict?: number;
  defaultOptions?: Record<string, any>;
}
 
export class OllamaStructuredClient {
  constructor(options?: OllamaStructuredClientOptions);
  ollama: any; // Simplified, can be more specific if needed
  model: string;
  defaultOptions: {
    temperature: number;
    num_predict: number;
  };
 
  generateStructured<T>(
    prompt: string,
    schema: object,
    zodSchema?: z.ZodSchema<T> | null,
    options?: Record<string, any>
  ): Promise<T>;
 
  generateWithRetry<T>(
    prompt: string,
    schema: object,
    zodSchema?: z.ZodSchema<T> | null,
    maxRetries?: number,
    options?: Record<string, any>
  ): Promise<T>;
 
  isModelAvailable(): Promise<boolean>;
  ensureModel(): Promise<void>;
}
 
export const schemas: Record<string, object>;
export const zodSchemas: Record<string, z.ZodSchema<any>>;
export function createCustomSchema(properties: object, required?: string[]): object;