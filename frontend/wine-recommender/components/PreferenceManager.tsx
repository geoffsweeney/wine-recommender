"use client"; // Mark as a Client Component

import React, { useState } from 'react'; // Import useState
import { PreferenceNode } from '../../../src/types'; // Import PreferenceNode type
import PreferenceList from './PreferenceList'; // Import PreferenceList
import PreferenceForm from './PreferenceForm'; // Import PreferenceForm

const PreferenceManager: React.FC = () => {
  // TODO: Replace with actual user ID from authentication context
  const userId = 'current_user_id'; // Placeholder user ID

  const [showForm, setShowForm] = useState(false);
  const [editingPreference, setEditingPreference] = useState<PreferenceNode | undefined>(undefined);

  const handleAddPreferenceClick = () => {
    setEditingPreference(undefined); // Clear any data from previous edits
    setShowForm(true);
  };

  const handleEditPreference = (preference: PreferenceNode) => {
    setEditingPreference(preference);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingPreference(undefined);
    // The PreferenceList component will revalidate automatically via SWR's mutate
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingPreference(undefined);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">User Preferences</h1>

      {!showForm && (
        <button
          onClick={handleAddPreferenceClick}
          className="mb-4 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          Add New Preference
        </button>
      )}

      {showForm ? (
        <PreferenceForm
          initialData={editingPreference}
          userId={userId}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      ) : (
        <PreferenceList userId={userId} onEdit={handleEditPreference} />
      )}
    </div>
  );
};

export default PreferenceManager;