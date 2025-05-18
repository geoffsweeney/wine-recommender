"use client"; // Mark as a Client Component

import React, { useState } from 'react'; // Import useState
import { PreferenceNode } from '../../../src/types'; // Import PreferenceNode type
import { updatePreference, deletePreference } from '../lib/api'; // Import API functions

interface PreferenceItemProps {
  preference: PreferenceNode;
  userId: string; // Add userId prop
  onPreferenceUpdated: () => void; // Handler to notify parent list to revalidate
  onPreferenceDeleted: () => void; // Handler to notify parent list to revalidate
  onEdit: (preference: PreferenceNode) => void; // Handler for edit
}

const PreferenceItem: React.FC<PreferenceItemProps> = ({ preference, userId, onPreferenceUpdated, onPreferenceDeleted, onEdit }) => {
  const [isActive, setIsActive] = useState(preference.active);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggle = async () => {
    const newIsActive = !isActive;
    setIsActive(newIsActive); // Optimistic update
    try {
      if (preference.id) {
        await updatePreference(userId, preference.id, { active: newIsActive });
        onPreferenceUpdated(); // Notify parent to revalidate
      } else {
         console.error('Preference ID is missing, cannot update.');
         setIsActive(isActive); // Revert optimistic update if no ID
      }
    } catch (error) {
      console.error('Failed to update preference active state:', error);
      setIsActive(isActive); // Revert optimistic update on error
      // TODO: Show a user-friendly error message (e.g., toast)
    }
  };

  const handleDelete = async () => {
    if (!preference.id) {
        console.error('Preference ID is missing, cannot delete.');
        return;
    }
    if (window.confirm('Are you sure you want to delete this preference?')) {
      setIsDeleting(true);
      try {
        await deletePreference(userId, preference.id);
        onPreferenceDeleted(); // Notify parent to revalidate
      } catch (error) {
        console.error('Failed to delete preference:', error);
        setIsDeleting(false); // Revert deleting state on error
        // TODO: Show a user-friendly error message (e.g., toast)
      }
    }
  };

  return (
    <div className="border p-4 mb-4 rounded shadow">
      <p>Type: {preference.type}</p>
      <p>Value: {Array.isArray(preference.value) ? preference.value.join(', ') : String(preference.value)}</p> {/* Handle array values */}
      <p>Source: {preference.source}</p>
      <p>Confidence: {preference.confidence}</p>
      <p>Timestamp: {new Date(preference.timestamp).toLocaleString()}</p> {/* Format timestamp */}
      <p>Negated: {preference.negated ? 'Yes' : 'No'}</p> {/* Display negated state */}

      <div className="mt-2">
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isActive}
            onChange={handleToggle}
          />
          <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
            Include in Pairing
          </span>
        </label>
      </div>

      <div className="mt-4">
        <button
          onClick={() => onEdit(preference)} // Call onEdit prop
          className="mr-2 px-3 py-1 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Edit
        </button>
        <button
          onClick={handleDelete} // Call handleDelete
          className="px-3 py-1 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          disabled={isDeleting} // Disable button while deleting
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
};

export default PreferenceItem;