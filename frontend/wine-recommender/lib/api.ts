import { PreferenceNode } from '../../../src/types'; // Import PreferenceNode type

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL || 'http://localhost:3001'; // Use environment variable, fallback to localhost:3001
const PREFERENCES_API_PATH = '/api/preferences'; // Path for preference API endpoints

// Helper function for making API requests
async function request<T>(method: string, path: string, data?: unknown): Promise<T> { // Use unknown for data
  const url = `${API_BASE_URL}${path}`; // Construct the full URL
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `API request failed with status ${response.status}`);
  }

  // Handle cases where the response might be empty (e.g., DELETE)
  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    return {} as T; // Return an empty object for empty responses
  }

  return response.json();
}

// API functions for preference management
export const getPreferences = (userId: string): Promise<PreferenceNode[]> => {
  return request<PreferenceNode[]>('GET', `${PREFERENCES_API_PATH}/${userId}`);
};

// Define a type for the input preference data when adding
type AddPreferenceInput = Omit<PreferenceNode, 'id'> & {
    source?: string; // Make source optional for input
    confidence?: number; // Make confidence optional for input
    timestamp?: string; // Make timestamp optional for input
};

export const addPreference = (userId: string, preference: AddPreferenceInput): Promise<PreferenceNode> => {
   // Add default values for source, confidence, and timestamp before sending
   const preferenceWithDefaults: PreferenceNode = {
       ...preference,
       source: preference.source || 'manual', // Default to manual if not provided
       confidence: preference.confidence ?? 1.0, // Default confidence (use ?? for null/undefined check)
       timestamp: preference.timestamp || new Date().toISOString(),
       // id will be assigned by the backend
   };
  return request<PreferenceNode>('POST', `${PREFERENCES_API_PATH}/${userId}`, preferenceWithDefaults);
};

export const updatePreference = (userId: string, preferenceId: string, updates: Partial<PreferenceNode>): Promise<PreferenceNode> => {
  return request<PreferenceNode>('PUT', `${PREFERENCES_API_PATH}/${userId}/${preferenceId}`, updates);
};

export const deletePreference = (userId: string, preferenceId: string): Promise<void> => {
  return request<void>('DELETE', `${PREFERENCES_API_PATH}/${userId}/${preferenceId}`);
};