import { IsString, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class Preferences {
  @IsString({ each: true })
  wineTypes?: string[];

  @IsString({ each: true })
  regions?: string[];

  @IsString({ each: true })
  grapes?: string[];
}

export class RecommendationRequest {
  @IsString()
  userId!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => Preferences)
  preferences!: Preferences;
}