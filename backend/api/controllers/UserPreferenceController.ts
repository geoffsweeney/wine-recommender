import { Request, Response } from 'express';

// Define a local interface to extend Request with validatedBody/Query/Params
interface ValidatedRequest extends Request {
  validatedBody?: any;
  validatedQuery?: any;
  validatedParams?: any;
}
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

  protected async executeImpl(req: ValidatedRequest, res: Response): Promise<void> { // Cast req to ValidatedRequest
    const { method } = req;
    const userId = req.validatedParams.userId; // Use validatedParams

    // No need for manual validation here, as it's handled by middleware
    if (!userId) {
      this.fail(res, 'User ID is required', 400);
      return;
    }

    switch (method) {
      case 'GET':
        // Since preferences are no longer persisted in Neo4j, return an empty array
        this.ok(res, []);
        break;

      default:
        this.fail(res, 'Method not allowed', 405);
    }
  }
}