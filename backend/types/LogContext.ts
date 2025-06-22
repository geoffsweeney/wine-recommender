export interface LogContext {
  source?: string;
  stage?: string;
  correlationId?: string;
  [key: string]: any; // Allow for additional arbitrary properties
}