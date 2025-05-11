import { validateRequest } from '../validation'; // Adjust the path as necessary
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const TestSchema = z.object({
  field: z.string()
});

// Mock objects
let mockRequest: Partial<Request>;
let mockResponse: Partial<Response>;
let mockNext: jest.MockedFunction<NextFunction>;

beforeEach(() => {
  mockRequest = {
    body: {},
    query: {}
  };
  mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  mockNext = jest.fn();
  jest.clearAllMocks();
});

it('should return 400 for invalid body', async () => {
  const middleware = validateRequest(TestSchema, 'body');
  mockRequest.body = { field: 123 };

  await middleware(mockRequest as Request, mockResponse as Response, mockNext);

  expect(mockResponse.status).toHaveBeenCalledWith(400);
  expect(mockResponse.json).toHaveBeenCalledWith({
    message: 'Validation failed',
    errors: [
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Expected string, received number',
        path: ['field'], // Changed to an array
        received: 'number', // Added received field
      },
    ],
  });
});