import { ParsedQs } from 'qs';

declare global {
  namespace Express {
    interface Request {
      parsedQuery?: any; // or use a more specific type if you have one
    }
  }
}

// This empty export is important to make this file a module
export {};