import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { BaseController } from '../BaseController';
import { TYPES } from '../../di/Types';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PreferenceNode } from '../../types';
import { ILogger } from '../../services/LLMService';

@injectable()
export class UserPreferenceController extends BaseController {
  constructor(
    @inject(TYPES.KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService,
    @inject(TYPES.Logger) private logger: ILogger
  ) {
    super();
  }

  protected async executeImpl(req: Request, res: Response): Promise<void> {
    const { method } = req;
    const userId = req.validatedParams.userId; // Use validatedParams

    // No need for manual validation here, as it's handled by middleware
    if (!userId) {
      this.fail(res, 'User ID is required', 400);
      return;
    }

    switch (method) {
      case 'GET':
        const preferences = await this.knowledgeGraphService.getPreferences(userId);
        this.ok(res, preferences);
        break;

      case 'POST':
      case 'PUT':
        const preference: PreferenceNode = req.validatedBody; // Use validatedBody
        // No need for manual validation here, as it's handled by middleware
        if (!preference || !preference.type ||
            preference.value === undefined ||
            preference.active === undefined) {
          this.fail(res, 'Invalid preference data provided', 400);
          return;
        }

        // Set defaults for optional fields (these should ideally be handled by Zod defaults if possible)
        preference.confidence = preference.confidence ?? 1.0;
        preference.source = preference.source ?? 'manual';
        preference.timestamp = preference.timestamp ?? new Date().toISOString();

        await this.knowledgeGraphService.addOrUpdatePreference(userId, preference);
        this.ok(res, { message: 'Preference added/updated successfully' });
        break;

      case 'DELETE':
        const preferenceId = req.validatedParams.preferenceId; // Use validatedParams
        // No need for manual validation here, as it's handled by middleware
        if (!preferenceId) {
          this.fail(res, 'Preference ID is required', 400);
          return;
        }

        try {
          await this.knowledgeGraphService.deletePreference(userId, preferenceId);
          this.ok(res, { message: 'Preference deleted successfully' });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to delete preference';
          this.fail(res, errorMessage, 400); // Return 400 for service-level errors
        }
        break;

      default:
        this.fail(res, 'Method not allowed', 405);
    }
  }
}