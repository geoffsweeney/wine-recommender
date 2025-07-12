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
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {
    super();
  }

  protected async executeImpl(req: ValidatedRequest, res: Response): Promise<void> { // Change to ValidatedRequest
    const { method } = req;
    let userId: string | undefined;
 
      try {
        // Validate userId from params for all user-specific routes
        if (req.validatedParams?.userId) { // Use validatedParams
          userId = req.validatedParams.userId;
        }
 
        if (method === 'GET') {
          if (!userId) { // GET /admin/preferences
            const allPreferences = await this.knowledgeGraphService.getAllUserPreferences();
            this.ok(res, allPreferences);
          } else { // GET /admin/preferences/:userId
            const preferences = await this.knowledgeGraphService.getPreferences(userId, true);
            this.ok(res, preferences);
          }
        } else if (method === 'PUT' && userId) { // PUT /admin/preferences/:userId
          const preferences: any[] = req.validatedBody; // Use validatedBody and ensure it's an array
          await this.knowledgeGraphService.addOrUpdateUserPreferences(userId, preferences);
          this.ok(res, { message: 'User preferences updated successfully' });
        } else if (method === 'DELETE' && userId) { // DELETE /admin/preferences/:userId
          const { type, value, preferenceId } = req.validatedQuery as DeletePreferenceQuery; // Use new DTO

          if (type && value) { // Check for type and value directly
            // Case 1: type and value are provided as separate query parameters
            await this.knowledgeGraphService.deletePreference(userId, type, value);
            this.ok(res, { message: `Preference type: ${type}, value: ${value} for user ${userId} deleted successfully` });
          } else if (preferenceId) { // Check for preferenceId
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
            // Case 3: No specific preference identifier, delete all preferences for the user
            await this.knowledgeGraphService.deleteAllPreferencesForUser(userId);
            this.ok(res, { message: `All preferences for user ${userId} deleted successfully` });
          }
      } else {
        this.fail(res, 'Method not allowed or invalid path', 405);
      }
    } catch (err) {
      this.logger.error(`Error in AdminUserPreferenceController: ${err instanceof Error ? err.message : String(err)}`);
      this.fail(res, err instanceof Error ? err : String(err), 500);
    }
  }
}