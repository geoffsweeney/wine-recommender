import { GrapeVariety } from './services/models/Wine';

export interface WineNode {
  id: string;
  name: string;
  type: string;
  region: string;
  vintage?: number;
  price?: number; // Added price property
  rating?: number;
  grapeVarieties?: GrapeVariety[];
}

export interface PreferenceNode {
  id?: string; // Optional ID for Neo4j
  type: string;
  value: string | number | boolean | string[] | number[];
  source: string; // e.g., 'regex', 'spaCy', 'Duckling', 'LLM', 'manual'
  confidence?: number; // Optional confidence score
  timestamp: string; // ISO 8601 string
  active: boolean;
  negated?: boolean;
}

export interface WineRecommendation extends WineNode {
  score?: number;
  matchReasons?: string[];
}

export interface RankedWineRecommendation extends WineRecommendation {
  rank: number;
  finalScore: number;
}

// Define a more specific interface for UserPreferences
export interface UserPreferences {
  wineType?: string; // Changed to string as per KnowledgeGraphService usage
  grapeVarietal?: string[];
  region?: string[];
  sweetness?: string;
  body?: string;
  priceRange?: [number, number]; // Added priceRange
  foodPairing?: string; // Added foodPairing
  excludeAllergens?: string[]; // Added excludeAllergens
  // Removed [key: string]: any; to enforce stricter typing
}
