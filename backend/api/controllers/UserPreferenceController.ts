import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { KnowledgeGraphService } from '../../services/KnowledgeGraphService';
import { PreferenceNode } from '../../types';

@injectable()
export class UserPreferenceController {
  constructor(
    @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService
  ) {}

  async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }
      const preferences = await this.knowledgeGraphService.getPreferences(userId);
      res.json(preferences);
    } catch (error: any) {
      console.error('Error getting preferences:', error);
      res.status(500).json({ error: 'Failed to retrieve preferences' });
    }
  }

  async addOrUpdatePreference(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
       if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }
      const preference: PreferenceNode = req.body;
      // Basic validation for required preference properties
      if (!preference || !preference.type || preference.value === undefined || preference.active === undefined) {
         res.status(400).json({ error: 'Invalid preference data provided' });
         return;
      }
      // Ensure confidence has a default if not provided
      if (preference.confidence === undefined) {
          preference.confidence = 1.0; // Default confidence for manually added/updated preferences
      }
       // Ensure source has a default if not provided
      if (!preference.source) {
          preference.source = 'manual'; // Default source for manually added/updated preferences
      }
       // Ensure timestamp is set if not provided
      if (!preference.timestamp) {
// Duplicate deletePreference method removed
// Duplicate deletePreference method removed
          preference.timestamp = new Date().toISOString();
      }


      await this.knowledgeGraphService.addOrUpdatePreference(userId, preference);
      res.status(200).json({ message: 'Preference added/updated successfully' });
    } catch (error: any) {
      console.error('Error adding or updating preference:', error);
      res.status(500).json({ error: 'Failed to add or update preference' });
    }
  }

  async deletePreference(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId;
      const preferenceId = req.params.preferenceId;
       if (!userId || !preferenceId) {
        res.status(400).json({ error: 'User ID and Preference ID are required' });
        return;
      }
      await this.knowledgeGraphService.deletePreference(userId, preferenceId);
      res.status(200).json({ message: 'Preference deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting preference:', error);
      res.status(500).json({ error: 'Failed to delete preference' });
    }
  }
}