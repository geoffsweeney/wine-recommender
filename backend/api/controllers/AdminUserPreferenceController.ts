import { Response } from 'express';
import { inject, injectable } from 'tsyringe';
import { ILogger, TYPES } from '../../di/Types';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { UserProfileService } from '../../services/UserProfileService';
import { BaseController } from '../BaseController';
import { DeletePreferenceQuery } from '../dtos/DeletePreferenceQuery.dto'; // Added
import { ValidatedRequest } from '../middleware/validation'; // Import ValidatedRequest

@injectable()
export class AdminUserPreferenceController extends BaseController {
  constructor(
    @inject(TYPES.UserProfileService) private readonly userProfileService: UserProfileService,
    @inject(TYPES.KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {
    super();
  }

  protected async executeImpl(req: ValidatedRequest, res: Response): Promise<void> { // Change to ValidatedRequest
    const { method } = req;
    let userId: string | undefined;
 
    this.logger.info(`AdminUserPreferenceController - Method: ${method}, Path: ${req.path}`);
    this.logger.info(`AdminUserPreferenceController - Validated Params: ${JSON.stringify(req.validatedParams)}`);
    this.logger.info(`AdminUserPreferenceController - Validated Body: ${JSON.stringify(req.validatedBody)}`);
    this.logger.info(`AdminUserPreferenceController - Validated Query: ${JSON.stringify(req.validatedQuery)}`);
 
      try {
        // Validate userId from params for all user-specific routes
        if (req.validatedParams?.userId) { // Use validatedParams
          userId = req.validatedParams.userId;
        }
 
        if (method === 'GET' && !userId) { // GET /admin/preferences
          this.logger.info('Entering GET /admin/preferences block');
          const allPreferences = await this.knowledgeGraphService.getAllUserPreferences();
          this.ok(res, allPreferences);
        }
        if (method === 'GET' && userId) { // GET /admin/preferences/:userId
          this.logger.info('Entering GET /admin/preferences/:userId block');
          const preferences = await this.knowledgeGraphService.getPreferences(userId, true);
          this.ok(res, preferences);
        }
        if (method === 'PUT' && userId) { // PUT /admin/preferences/:userId
          this.logger.info('Entering PUT /admin/preferences/:userId block');
          const preferences: any[] = req.validatedBody; // Use validatedBody and ensure it's an array
          await this.knowledgeGraphService.addOrUpdateUserPreferences(userId, preferences);
          this.ok(res, preferences); // Return the preferences that were updated
        }
        if (method === 'DELETE' && userId) { // DELETE /admin/preferences/:userId
          this.logger.info('Entering DELETE /admin/preferences/:userId block');
          const { type, value, preferenceId } = req.validatedQuery as DeletePreferenceQuery; // Use new DTO
 
          if (type && value) { // Check for type and value directly
            this.logger.info('Entering DELETE with type and value');
            // Case 1: type and value are provided as separate query parameters
            await this.knowledgeGraphService.deletePreference(userId, type, value);
            this.ok(res, { message: `Preference type: ${type}, value: ${value} for user ${userId} deleted successfully` });
          } else if (preferenceId) { // Check for preferenceId
            this.logger.info('Entering DELETE with preferenceId');
            // Case 2: preferenceId is provided as a composite string (e.g., "type:value")
            const parts = preferenceId.split(':');
            if (parts.length !== 2) {
              this.fail(res, 'Invalid preferenceId format. Expected "type:value".', 400);
              return;
            }
            const [prefType, prefValue] = parts;
            await this.knowledgeGraphService.deletePreference(userId, prefType, prefValue);
            this.ok(res, { message: `Preference ${preferenceId} for user ${userId} deleted successfully` });
          } else {
            this.logger.info('Entering DELETE all preferences');
            // Case 3: No specific preference identifier, delete all preferences for the user
            await this.knowledgeGraphService.deleteAllPreferencesForUser(userId);
            this.ok(res, { message: `All preferences for user ${userId} deleted successfully` });
          }
        }
        // If none of the above conditions are met, it's an unhandled method/path
        if (!res.headersSent) { // Only send 405 if a response hasn't already been sent
          this.fail(res, 'Method not allowed or invalid path', 405);
        }
    } catch (err) {
      this.logger.error(`Error in AdminUserPreferenceController: ${err instanceof Error ? err.message : String(err)}`);
      this.fail(res, err instanceof Error ? err : String(err), 500);
    }
  }
}
