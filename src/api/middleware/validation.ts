import { Request, Response, NextFunction } from 'express';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export function validateRequest<T extends object>(type: ClassConstructor<T>, source: 'body' | 'query') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = plainToInstance(type, req[source]);
      const errors = await validate(input);

      if (errors.length > 0) {
        const errorMessages = errors.flatMap(error =>
          Object.values(error.constraints || {})
        );
        res.status(400).json({
          status: 400,
          message: 'Validation failed',
          errors: errorMessages
        });
        return;
      }

      req[source] = input;
      next();
    } catch (err) {
      res.status(500).json({
        status: 500,
        message: 'Internal server error during validation'
      });
    }
  };
}