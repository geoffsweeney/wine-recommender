import { validateRequest } from '../validation';
import { Request, Response, NextFunction } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

jest.mock('class-transformer');
jest.mock('class-validator');

class TestDTO {
  field!: string;
}

describe('validateRequest', () => {
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
    (plainToInstance as jest.Mock).mockImplementation((_, obj) => obj);
    (validate as jest.Mock).mockResolvedValue([]);
  });

  describe('body validation', () => {
    it('should validate successfully and call next', async () => {
      const middleware = validateRequest(TestDTO, 'body');
      mockRequest.body = { field: 'test' };

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid body', async () => {
      (validate as jest.Mock).mockResolvedValueOnce([
        { constraints: { isString: 'field must be a string' } }
      ]);
      const middleware = validateRequest(TestDTO, 'body');
      mockRequest.body = { field: 123 };

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 400,
        message: 'Validation failed',
        errors: ['field must be a string']
      });
    });
  });

  describe('query validation', () => {
    it('should validate successfully and call next', async () => {
      const middleware = validateRequest(TestDTO, 'query');
      mockRequest.query = { field: 'test' };

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid query', async () => {
      (validate as jest.Mock).mockResolvedValueOnce([
        { constraints: { isString: 'field must be a string' } }
      ]);
      const middleware = validateRequest(TestDTO, 'query');
      mockRequest.query = { field: '123' };

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 400,
        message: 'Validation failed',
        errors: ['field must be a string']
      });
    });
  });

  it('should handle validation errors', async () => {
    (validate as jest.Mock).mockRejectedValueOnce(new Error('Validation error'));
    const middleware = validateRequest(TestDTO, 'body');

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      status: 500,
      message: 'Internal server error during validation'
    });
  });
});