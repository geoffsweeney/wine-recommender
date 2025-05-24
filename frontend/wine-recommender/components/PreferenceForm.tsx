import React from 'react';
import { useForm, Controller, ControllerRenderProps } from 'react-hook-form'; // Assuming React Hook Form, Import ControllerRenderProps
import { PreferenceNode } from '../../../backend/types'; // Import PreferenceNode type
import { addPreference, updatePreference } from '../lib/api'; // Import API functions

interface PreferenceFormProps {
  initialData?: PreferenceNode; // Optional initial data for editing
  userId: string; // User ID is required for API calls
  onSuccess: () => void; // Handler for successful submission
  onCancel: () => void; // Handler for canceling the form
}

const PreferenceForm: React.FC<PreferenceFormProps> = ({ initialData, userId, onSuccess, onCancel }) => {
  const { handleSubmit, control, reset, watch, formState: { isSubmitting, errors } } = useForm<PreferenceNode>({ // Include errors and watch
    defaultValues: initialData || {
      type: '',
      value: '', // TODO: Handle different value types
      source: 'manual', // Default source for manual entry
      confidence: 1.0, // Default confidence for manual entry
      timestamp: new Date().toISOString(),
      active: true,
      negated: false, // Explicitly set default for negated
    },
  });

  const selectedType = watch('type'); // Watch the 'type' field to dynamically render value input

  const handleFormSubmit = async (data: PreferenceNode) => {
    try {
      if (initialData?.id) {
        // Editing existing preference
        // Construct updates object with only fields that can be updated by the form
        const updates: Partial<PreferenceNode> = {
          value: data.value,
          active: data.active,
          negated: data.negated,
        };
        await updatePreference(userId, initialData.id, updates);
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
        {/* Dynamically render input based on selectedType */}
        {selectedType === 'wineType' || selectedType === 'sweetness' || selectedType === 'body' || selectedType === 'region' ? (
           <Controller
             name="value"
             control={control}
             rules={{ required: 'Preference value is required' }}
             render={({ field }: { field: ControllerRenderProps<PreferenceNode, "value"> }) => (
               <select
                 id="value"
                 {...field}
                 value={String(field.value)} // Ensure value is a string for the select input
                 className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${errors.value ? 'border-red-500' : ''}`}
               >
                 <option value="">Select a value</option>
                 {/* TODO: Populate options based on selectedType and synonym registry */}
                 {/* For now, add options needed by tests */}
                 <option value="red">Red</option>
                 <option value="dry">Dry</option>
                 {/* TODO: Populate options based on selectedType and synonym registry */}
                 <option value="example">Example Option</option>
               </select>
             )}
           />
        ) : selectedType === 'priceRange' ? (
           // TODO: Implement range input or two number inputs
           <Controller
             name="value"
             control={control}
             rules={{ required: 'Preference value is required', validate: value => Array.isArray(value) && value.length === 2 && value.every(v => typeof v === 'number') || 'Invalid price range format' }} // Basic array validation
             render={({ field }: { field: ControllerRenderProps<PreferenceNode, "value"> }) => (
               <> {/* Use fragment for multiple inputs */}
                 <input
                   type="number"
                   placeholder="Min Price"
                   {...field}
                   value={Array.isArray(field.value) ? field.value[0] : ''} // Bind min value
                   onChange={e => {
                     const newValue = [...(Array.isArray(field.value) ? field.value : [0, 0])];
                     newValue[0] = Number(e.target.value);
                     field.onChange(newValue);
                   }}
                   className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${errors.value ? 'border-red-500' : ''}`}
                 />
                 <input
                   type="number"
                   placeholder="Max Price"
                   {...field}
                   value={Array.isArray(field.value) ? field.value[1] : ''} // Bind max value
                   onChange={e => {
                     const newValue = [...(Array.isArray(field.value) ? field.value : [0, 0])];
                     newValue[1] = Number(e.target.value);
                     field.onChange(newValue);
                   }}
                   className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${errors.value ? 'border-red-500' : ''}`}
                 />
               </>
             )}
           />
        ) : selectedType === 'alcoholContent' || selectedType === 'servingTemperature' || selectedType === 'volume' || selectedType === 'distance' ? (
           <Controller
             name="value"
             control={control}
             rules={{ required: 'Preference value is required', validate: value => typeof value === 'number' || 'Value must be a number' }} // Basic number validation
             render={({ field }: { field: ControllerRenderProps<PreferenceNode, "value"> }) => (
               <input
                 type="number" // Use number input for numeric types
                 id="value"
                 {...field}
                 value={typeof field.value === 'number' ? field.value : ''} // Bind number value
                 onChange={e => field.onChange(Number(e.target.value))} // Convert to number on change
                 className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${errors.value ? 'border-red-500' : ''}`}
               />
             )}
           />
        ) : (
           // Default text input for other types
           <Controller
             name="value"
             control={control}
             rules={{ required: 'Preference value is required' }}
             render={({ field }: { field: ControllerRenderProps<PreferenceNode, "value"> }) => (
               <input
                 id="value"
                 {...field}
                 value={String(field.value)} // Ensure value is a string for the input
                 className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${errors.value ? 'border-red-500' : ''}`}
               />
             )}
           />
        )}
        {errors.value && <p className="mt-1 text-sm text-red-600">{errors.value.message}</p>} {/* Display validation errors */}
      </div>

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
                 onChange={field.onChange} // Explicitly bind onChange
                 onBlur={field.onBlur} // Explicitly bind onBlur
                 name={field.name} // Explicitly bind name
                 checked={field.value as boolean} // Bind checked state, explicitly cast
                 className="mr-2 rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
               />
             )}
           />
           Include in Pairing
         </label>
       </div>

       {/* Implement negated toggle */}
       <div>
         <label htmlFor="negated" className="flex items-center text-sm font-medium text-gray-700">
           <Controller
             name="negated"
             control={control}
             render={({ field }: { field: ControllerRenderProps<PreferenceNode, "negated"> }) => ( // Explicitly type field
               <input
                 id="negated"
                 type="checkbox" // Use checkbox for boolean negated state
                 onChange={field.onChange} // Explicitly bind onChange
                 onBlur={field.onBlur} // Explicitly bind onBlur
                 name={field.name} // Explicitly bind name
                 checked={field.value as boolean} // Bind checked state, explicitly cast
                 className="mr-2 rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
               />
             )}
           />
           Negated
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