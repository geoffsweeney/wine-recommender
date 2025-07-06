// Shared interfaces/types for the frontend application

export type User = {
  id: number;
  name: string;
};

export interface GrapeVariety {
  name: string;
  percentage?: number;
}

export interface WineRecommendationOutput {
  name: string;
  grapeVarieties?: GrapeVariety[];
}

export interface RecommendationResult {
  recommendations: WineRecommendationOutput[];
  reasoning?: string;
  confidence: number;
  pairingNotes?: string;
  alternatives?: WineRecommendationOutput[];
  source?: 'knowledge_graph' | 'llm' | 'hybrid';
  error?: string;
}

export interface FinalRecommendationPayload {
  primaryRecommendation: WineRecommendationOutput | null;
  alternatives: WineRecommendationOutput[];
  explanation: string;
  confidence: number;
  conversationId: string;
  canRefine: boolean;
}
