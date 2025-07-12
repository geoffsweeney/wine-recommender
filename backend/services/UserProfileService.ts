import { inject, injectable } from 'tsyringe'; // Import inject
import { ILogger, TYPES } from '../di/Types'; // Import TYPES from centralized location
import { UserPreferences } from '../types'; // Import UserPreferences
import { KnowledgeGraphService } from './KnowledgeGraphService'; // Import KnowledgeGraphService
 
 @injectable()
 export class UserProfileService {
   constructor(
     @inject(TYPES.Logger) private logger: ILogger, // Inject logger
     @inject(KnowledgeGraphService) private readonly knowledgeGraphService: KnowledgeGraphService // Inject KnowledgeGraphService
   ) {}
 
   /**
    * Retrieves the current accumulated preferences for a user.
    * @param userId The ID of the user.
    * @returns A Promise that resolves to the UserPreferences object.
    */
   async getPreferences(userId: string): Promise<UserPreferences> {
     this.logger.debug(`UserProfileService: Retrieving preferences for user ${userId}`);
     const preferenceNodes = await this.knowledgeGraphService.getPreferences(userId);
     const userPreferences: UserPreferences = {};
     preferenceNodes.forEach((node: any) => {
       // Explicitly check for known preference types and assign values
       switch (node.type) {
         case 'wineType':
           userPreferences.wineType = node.value;
           break;
         case 'grapeVarietal':
           userPreferences.grapeVarietal = node.value;
           break;
         case 'region':
           userPreferences.region = node.value;
           break;
         case 'country':
           userPreferences.country = node.value;
           break;
         case 'sweetness':
           userPreferences.sweetness = node.value;
           break;
         case 'body':
           userPreferences.body = node.value;
           break;
         case 'priceRange':
           userPreferences.priceRange = node.value;
           break;
         case 'foodPairing':
           userPreferences.foodPairing = node.value;
           break;
         case 'excludeAllergens':
           userPreferences.excludeAllergens = node.value;
           break;
         case 'wineCharacteristics':
           userPreferences.wineCharacteristics = node.value;
           break;
         default:
           // Log or handle unknown preference types if necessary
           this.logger.warn(`Unknown preference type encountered: ${node.type}`);
           break;
       }
     });
     return userPreferences;
   }
 
   /**
    * Saves or updates the preferences for a user.
    * @param userId The ID of the user.
    * @param preferences The UserPreferences object to save.
    */
   async savePreferences(userId: string, preferences: UserPreferences): Promise<void> {
     this.logger.debug(`UserProfileService: Saving preferences for user ${userId}: ${JSON.stringify(preferences)}`);
     // Convert UserPreferences object to an array of preference nodes
     const preferenceNodes = Object.entries(preferences).map(([type, value]) => ({
       type,
       value,
       source: 'user-input', // Or derive from context
       confidence: 1.0,
       timestamp: Date.now(),
       active: true,
     }));
     await this.knowledgeGraphService.addOrUpdateUserPreferences(userId, preferenceNodes);
   }
 }