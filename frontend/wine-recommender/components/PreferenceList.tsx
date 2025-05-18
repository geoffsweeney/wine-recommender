"use client"; // Mark as a Client Component

import React from 'react';
import useSWR from 'swr'; // Assuming SWR for data fetching
import { PreferenceNode } from '../../../src/types'; // Import PreferenceNode type

import PreferenceItem from './PreferenceItem'; // Import PreferenceItem component

import { getPreferences, deletePreference } from '../lib/api'; // Import API functions

// Define a fetcher function for SWR using the API function
// const fetcher = (userId: string) => getPreferences(userId); // No longer needed

interface PreferenceListProps {
  userId: string; // User ID to fetch preferences for
  onEdit: (preference: PreferenceNode) => void; // Handler for editing a preference
}

const PreferenceList: React.FC<PreferenceListProps> = ({ userId, onEdit }) => { // Destructure onEdit from props
  // Fetch preferences using SWR, passing userId as the key and the API function as the fetcher
  const { data: preferences, error, mutate } = useSWR<PreferenceNode[]>(userId, getPreferences); // Use getPreferences directly

  if (error) return <div>Failed to load preferences</div>;
  // Explicitly type preferences as PreferenceNode[]
  if (!preferences) return <div>Loading preferences...</div>;

  const handleEdit = (preference: PreferenceNode) => {
      // Call the onEdit prop passed from the parent (preferences.tsx)
      onEdit(preference);
  };

  const handleDelete = async (preferenceId: string) => {
    try {
        await deletePreference(userId, preferenceId); // Call the API to delete the preference
        mutate(); // Revalidate the preferences after deletion
    } catch (error) {
        console.error('Error deleting preference:', error);
    }
  };


  return (
    <div>
      <h2>Your Preferences</h2>
      {preferences.length === 0 ? (
        <p>No preferences found.</p>
      ) : (
        <ul>
          {/* Explicitly type preference as PreferenceNode */}
          {preferences.map((preference: PreferenceNode) => (
            <li key={preference.id || `${preference.type}-${preference.value}`}>
              {/* Render PreferenceItem component */}
              <PreferenceItem
                preference={preference}
                userId={userId} // Pass userId
                onPreferenceUpdated={mutate} // Pass mutate for revalidation on update
                onPreferenceDeleted={() => handleDelete(preference.id!)} // Pass delete handler
                onEdit={handleEdit} // Pass edit handler
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PreferenceList;