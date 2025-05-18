export interface WineNode {
  id: string;
  name: string;
  type: string;
  region: string;
  vintage?: number;
  price?: number; // Added price property
  rating?: number;
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
