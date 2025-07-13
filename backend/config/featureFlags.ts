export interface FeatureFlags {
  adminConversationalPreferences: boolean;
}

export const featureFlags: FeatureFlags = {
  adminConversationalPreferences: true, // Enabled for admin commands
};