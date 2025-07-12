export interface FeatureFlags {
  adminConversationalPreferences: boolean;
}

export const featureFlags: FeatureFlags = {
  adminConversationalPreferences: false, // Default to false
};