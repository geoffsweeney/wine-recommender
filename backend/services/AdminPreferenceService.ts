import { injectable, inject } from 'tsyringe';
import { AdminUserPreferenceController } from '../api/controllers/AdminUserPreferenceController';
import { ILogger, TYPES } from '../di/Types';
import { Result } from '../core/types/Result';
import { success, failure } from '../utils/result-utils';
import { AgentError } from '../core/agents/AgentError';
import { DeletePreferenceQuery } from '../api/dtos/DeletePreferenceQuery.dto';

@injectable()
export class AdminPreferenceService {
  constructor(
    @inject(AdminUserPreferenceController) private readonly adminUserPreferenceController: AdminUserPreferenceController,
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {}

  private async executeControllerAction(
    method: string,
    userId: string,
    correlationId: string, // Add correlationId parameter
    body?: any[],
    query?: DeletePreferenceQuery | {}
  ): Promise<Result<any, AgentError>> {
    const controllerReq: any = {
      method: method,
      validatedParams: { userId: userId },
      validatedBody: body || [],
      validatedQuery: query || {},
    };
    const controllerRes: any = {
      status: (code: number) => {
        controllerRes.statusCode = code;
        return controllerRes;
      },
      json: (data: any) => {
        controllerRes.jsonResponse = data;
        return controllerRes;
      },
      send: (data: any) => {
        controllerRes.jsonResponse = data;
        return controllerRes;
      },
    };

    try {
      // Temporarily cast to any to call protected method for demonstration.
      // In a real scenario, AdminUserPreferenceController would expose public methods
      // or this service would directly interact with the underlying data layer.
      await (this.adminUserPreferenceController as any).executeImpl(controllerReq, controllerRes);
      
      if (controllerRes.statusCode >= 200 && controllerRes.statusCode < 300) {
        return success(controllerRes.jsonResponse);
      } else {
        return failure(new AgentError(
          controllerRes.jsonResponse?.error || 'Unknown error from controller',
          'CONTROLLER_ERROR',
          'AdminPreferenceService',
          correlationId, // Use passed correlationId
          true,
          { statusCode: controllerRes.statusCode, response: controllerRes.jsonResponse }
        ));
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error executing controller action: ${errorMessage}`, { error });
      return failure(new AgentError(
        `Failed to execute controller action: ${errorMessage}`,
        'SERVICE_EXECUTION_ERROR',
        'AdminPreferenceService',
        correlationId, // Use passed correlationId
        true,
        { originalError: errorMessage }
      ));
    }
  }

  async viewUserPreferences(userId: string, correlationId: string): Promise<Result<any, AgentError>> {
    return this.executeControllerAction('GET', userId, correlationId);
  }

  async addOrUpdateUserPreferences(userId: string, preferences: any[], correlationId: string): Promise<Result<any, AgentError>> {
    return this.executeControllerAction('PUT', userId, correlationId, preferences);
  }

  async deletePreference(userId: string, correlationId: string, type?: string, value?: string, preferenceId?: string): Promise<Result<any, AgentError>> {
    const query: DeletePreferenceQuery = {};
    if (type && value) {
      query.type = type;
      query.value = value;
    } else if (preferenceId) {
      query.preferenceId = preferenceId;
    }
    return this.executeControllerAction('DELETE', userId, correlationId, undefined, query);
  }

  async deleteAllPreferencesForUser(userId: string, correlationId: string): Promise<Result<any, AgentError>> {
    return this.executeControllerAction('DELETE', userId, correlationId, undefined, {});
  }
}