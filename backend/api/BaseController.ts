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

  public ok<T>(res: Response, dto?: T) {
    if (dto) {
      return res.status(200).json(dto);
    }
    return res.sendStatus(200);
  }

  public created(res: Response) {
    return res.sendStatus(201);
  }

  public clientError(res: Response, message?: string) {
    return BaseController.jsonResponse(res, 400, message || 'Unauthorized');
  }

  public unauthorized(res: Response, message?: string) {
    return BaseController.jsonResponse(res, 401, message || 'Unauthorized');
  }

  public forbidden(res: Response, message?: string) {
    return BaseController.jsonResponse(res, 403, message || 'Forbidden');
  }

  public notFound(res: Response, message?: string) {
    return BaseController.jsonResponse(res, 404, message || 'Not found');
  }

  public conflict(res: Response, message?: string) {
    return BaseController.jsonResponse(res, 409, message || 'Conflict');
  }

  public fail(res: Response, error: Error | string) {
    console.error(error);
    return res.status(500).json({
      message: error.toString()
    });
  }
}