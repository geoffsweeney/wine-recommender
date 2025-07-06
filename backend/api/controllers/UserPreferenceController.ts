import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { ILogger, TYPES } from '../../di/Types';
import { BaseController } from '../BaseController';

// Define a local interface to extend Request with validatedBody/Query/Params
interface ValidatedRequest extends Request {
  validatedBody?: any;
  validatedQuery?: any;
  validatedParams?: any;
}

@injectable()
export class UserPreferenceController extends BaseController {
  constructor(
    @inject(TYPES.UserProfileService) private readonly userProfileService: any, // Use correct DI token
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {
    super();
  }

  protected async executeImpl(req: ValidatedRequest, res: Response): Promise<void> {
    const { method } = req;
    const userId = req.validatedParams.userId;

    if (!userId) {
      this.fail(res, 'User ID is required', 400);
      return;
    }

    switch (method) {
      case 'GET': {
        try {
          const preferences = await this.userProfileService.getPreferences(userId);
          this.ok(res, preferences);
        } catch (err) {
          this.fail(res, err instanceof Error ? err : String(err), 500);
        }
        break;
      }
      case 'POST': {
        try {
          const preferences = req.validatedBody;
          await this.userProfileService.savePreferences(userId, preferences);
          this.ok(res, { message: 'Preferences saved successfully' });
        } catch (err) {
          this.fail(res, err instanceof Error ? err : String(err), 500);
        }
        break;
      }
      default:
        this.fail(res, 'Method not allowed', 405);
    }
  }
}
