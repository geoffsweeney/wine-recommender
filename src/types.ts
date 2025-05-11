export interface WineNode {
  id: string;
  name: string;
  type: string;
  region: string;
  vintage?: number;
  price?: number; // Added price property
  rating?: number;
}