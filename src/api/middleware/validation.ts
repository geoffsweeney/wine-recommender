import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

// Create an interface that extends the Express Request type
interface RequestWithParsedQuery extends Request {
  parsedQuery: any;
}

export function validateRequest<T>(schema: ZodSchema<T>, source: 'body' | 'query') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('Validating:', source, req[source]);
      const result = schema.safeParse(req[source]);

      if (!result.success) {
        console.log('Validation failed:', result.error);
        res.status(400).json({
          status: 400,
          message: 'Validation failed',
          errors: result.error.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        });
        return;
      }

      if (source === 'query') {
        // Cast the req to our custom interface
        (req as RequestWithParsedQuery).parsedQuery = result.data;
      } else {
        req[source] = result.data;
      }
      next();
    } catch (err) {
      console.error('Validation error:', err);
      res.status(500).json({
        status: 500,
        message: 'Internal server error during validation'
      });
    }
  };
}