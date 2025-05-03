export interface WineNode {
  id: string;
  name: string;
  type: string;
  region: string;
  vintage?: number;
  rating?: number;
  priceRange?: string;
}