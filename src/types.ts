export interface WineNode {
  id: string;
  name: string;
  type: string;
  region: string;
  vintage: number;
}

export interface WineRecommendationParams {
  wineTypeId: string;
  regionId: string;
}