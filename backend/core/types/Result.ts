import { AgentError } from '../agents/AgentError';

export type Result<T, E = AgentError> = 
  | { success: true; data: T }
  | { success: false; error: E };