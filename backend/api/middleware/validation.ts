import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';

// Define a local interface to extend Request with validatedBody/Query/Params
interface ValidatedRequest extends Request {
  validatedBody?: any;
  validatedQuery?: any;
  validatedParams?: any;
}

export const validateRequest = (schema: any, source: 'body' | 'query' | 'params'): RequestHandler => {
  return async (req: ValidatedRequest, res: Response, next: NextFunction): Promise<void> => { // Make async and return Promise<void>
    console.log('Validating:', req[source]); // Log the incoming request body or query
    try {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        console.error('Validation errors:', result.error.errors); // Log validation errors
        await res.status(400).json({ // Await the response
          message: 'Validation failed',
          errors: result.error.errors
        });
        return; // Terminate the request here
      } else {
        // Assign validated and transformed data to a new property to avoid issues with getters
        // The original req.body, req.query, req.params are left untouched.
        // Controllers should use req.validatedBody, req.validatedQuery, req.validatedParams
        if (source === 'body') {
          req.validatedBody = result.data;
        } else if (source === 'query') {
          req.validatedQuery = result.data;
        } else if (source === 'params') {
          req.validatedParams = result.data;
        }
        next(); // Proceed to the next middleware
      }
    } catch (err) {
      console.error('Unexpected error during validation:', err); // Log unexpected errors
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
