import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';

export const validateRequest = (schema: any, source: 'body' | 'query' | 'params'): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    console.log('Validating:', req[source]); // Log the incoming request body or query
    try {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        console.error('Validation errors:', result.error.errors); // Log validation errors
        res.status(400).json({
          message: 'Validation failed',
          errors: result.error.errors
        });
      } else {
        next(); // Proceed to the next middleware
      }
    } catch (err) {
      console.error('Unexpected error during validation:', err); // Log unexpected errors
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};