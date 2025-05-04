import { ParsedQs } from 'express';

declare module 'express' {
  interface Request {
    parsedQuery?: ParsedQs;
  }
}