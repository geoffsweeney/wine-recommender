import { BaseController } from '../BaseController';
import { Request, Response } from 'express';

class TestController extends BaseController {
  protected async executeImpl(req: Request, res: Response): Promise<void> {
    this.ok(res);
    return;
  }
}

describe('BaseController', () => {
  let controller: TestController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new TestController();
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      sendStatus: jest.fn()
    };
  });

  describe('ok', () => {
    it('should send 200 status with data when provided', () => {
      const testData = { key: 'value' };
      controller.ok(mockResponse as Response, testData);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(testData);
    });

    it('should send 200 status without data when not provided', () => {
      controller.ok(mockResponse as Response);
      expect(mockResponse.sendStatus).toHaveBeenCalledWith(200);
    });
  });

  describe('error responses', () => {
    it('clientError should return 400', () => {
      controller.clientError(mockResponse as Response, 'test');
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('forbidden should return 403', () => {
      controller.forbidden(mockResponse as Response, 'test');
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('notFound should return 404', () => {
      controller.notFound(mockResponse as Response, 'test');
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('conflict should return 409', () => {
      controller.conflict(mockResponse as Response, 'test');
      expect(mockResponse.status).toHaveBeenCalledWith(409);
    });

    it('fail should return 500', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      controller.fail(mockResponse as Response, 'test');
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(consoleSpy).toHaveBeenCalledWith('test');
      consoleSpy.mockRestore();
    });
  });

  describe('execute', () => {
    it('should call executeImpl', async () => {
      const executeImplSpy = jest.spyOn(controller as any, 'executeImpl');
      await controller.execute(
        mockRequest as Request,
        mockResponse as Response
      );
      expect(executeImplSpy).toHaveBeenCalled();
    });
  });
});