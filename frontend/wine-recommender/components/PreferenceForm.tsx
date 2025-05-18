import React from 'react';
import { useForm, Controller, ControllerRenderProps } from 'react-hook-form'; // Assuming React Hook Form, Import ControllerRenderProps
import { PreferenceNode } from '../../../src/types'; // Import PreferenceNode type
import { addPreference, updatePreference } from '../lib/api'; // Import API functions

interface PreferenceFormProps {
  initialData?: PreferenceNode; // Optional initial data for editing
  userId: string; // User ID is required for API calls
  onSuccess: () => void; // Handler for successful submission
  onCancel: () => void; // Handler for canceling the form
}

const PreferenceForm: React.FC<PreferenceFormProps> = ({ initialData, userId, onSuccess, onCancel }) => {
  const { handleSubmit, control, reset, formState: { isSubmitting, errors } } = useForm<PreferenceNode>({ // Include errors
    defaultValues: initialData || {
      type: '',
      value: '', // TODO: Handle different value types
      source: 'manual', // Default source for manual entry
      confidence: 1.0, // Default confidence for manual entry
      timestamp: new Date().toISOString(),
      active: true,
    },
  });

  const handleFormSubmit = async (data: PreferenceNode) => {
    try {
      if (initialData?.id) {
        // Editing existing preference
        await updatePreference(userId, initialData.id, data);
      } else {
        // Adding new preference
        await addPreference(userId, data);
      }
      onSuccess(); // Call success handler
      reset(); // Reset form after submission
    } catch (error) {
      console.error('Failed to save preference:', error);
      // TODO: Show a user-friendly error message (e.g., toast)
    }
  };

  // TODO: Implement form fields for type, value, active state, etc.
  // TODO: Implement submit and cancel buttons

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">Preference Type</label>
        <Controller
          name="type"
          control={control}
          rules={{ required: 'Preference type is required' }}
          render={({ field }: { field: ControllerRenderProps<PreferenceNode, "type"> }) => ( // Explicitly type field
            <input
              id="type"
              {...field}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${errors.type ? 'border-red-500' : ''}`} // Add error styling
            />
          )}
        />
        {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>} {/* Display validation errors */}
      </div>

      <div>
        <label htmlFor="value" className="block text-sm font-medium text-gray-700">Preference Value</label>
        <Controller
          name="value"
          control={control}
          rules={{ required: 'Preference value is required' }}
          render={({ field }: { field: ControllerRenderProps<PreferenceNode, "value"> }) => ( // Explicitly type field
            <input
              id="value"
              {...field}
              value={String(field.value)} // Ensure value is a string for the input
              // TODO: Adjust input type based on preference type (e.g., number, checkbox) and handle value conversion
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${errors.value ? 'border-red-500' : ''}`} // Add error styling
            />
          )}
        />
        {errors.value && <p className="mt-1 text-sm text-red-600">{errors.value.message}</p>} {/* Display validation errors */}
      </div>

      {errors.value && <p className="mt-1 text-sm text-red-600">{errors.value.message}</p>} {/* Display validation errors */}

       {/* Implement active toggle */}
       <div>
         <label htmlFor="active" className="flex items-center text-sm font-medium text-gray-700">
           <Controller
             name="active"
             control={control}
             render={({ field }: { field: ControllerRenderProps<PreferenceNode, "active"> }) => ( // Explicitly type field
               <input
                 id="active"
                 type="checkbox" // Use checkbox for boolean active state
                 {...field}
                 checked={field.value} // Bind checked state
                 className="mr-2 rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
               />
             )}
           />
           Include in Pairing
         </label>
       </div>

      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          disabled={isSubmitting} // Disable while submitting
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          disabled={isSubmitting} // Disable while submitting
        >
          {isSubmitting ? 'Saving...' : 'Save Preference'} {/* Show saving state */}
        </button>
      </div>
    </form>
  );
};

export default PreferenceForm;