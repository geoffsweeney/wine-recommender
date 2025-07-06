import { Request, Response } from 'express';

export abstract class BaseController {
  protected abstract executeImpl(req: Request, res: Response): Promise<void | any>;

  public async execute(req: Request, res: Response): Promise<void> {
    try {
      await this.executeImpl(req, res);
    } catch (err) {
      console.error(`[BaseController]: Uncaught controller error`);
      console.error(err);
      this.fail(res, 'An unexpected error occurred');
    }
  }

  public static jsonResponse(res: Response, code: number, message: string) {
    return res.status(code).json({ message });
  }

  public ok<T>(res: Response, dto?: T): void {
    if (dto) {
      res.status(200).json(dto);
    } else {
      res.sendStatus(200);
    }
  }

  public created(res: Response): void {
    res.sendStatus(201);
  }

  public clientError(res: Response, message?: string): void {
    BaseController.jsonResponse(res, 400, message ?? 'Bad Request');
  }

  public unauthorized(res: Response, message?: string): void {
    BaseController.jsonResponse(res, 401, message ?? 'Unauthorized');
  }

  public forbidden(res: Response, message?: string): void {
    BaseController.jsonResponse(res, 403, message ?? 'Forbidden');
  }

  public notFound(res: Response, message?: string): void {
    BaseController.jsonResponse(res, 404, message ?? 'Not found');
  }

  public conflict(res: Response, message?: string): void {
    BaseController.jsonResponse(res, 409, message ?? 'Conflict');
  }

  public fail(res: Response, error: Error | string, statusCode: number = 500): void {
    console.error(error);
    res.status(statusCode).json({
      message: error.toString()
    });
  }
}