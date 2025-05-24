import React from 'react';
import { useForm, Controller, ControllerRenderProps } from 'react-hook-form';
import { PreferenceNode } from '../../../backend/types';
import { addPreference, updatePreference } from '../lib/api';

interface PreferenceFormProps {
  initialData?: PreferenceNode;
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const PreferenceForm: React.FC<PreferenceFormProps> = ({ initialData, userId, onSuccess, onCancel }) => {
  const { handleSubmit, control, reset, watch, formState: { isSubmitting, errors } } = useForm<PreferenceNode>({
    defaultValues: initialData || {
      type: '',
      value: '',
      source: 'manual',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
      active: true,
      negated: false,
    },
  });

  const selectedType = watch('type');

  const handleFormSubmit = async (data: PreferenceNode) => {
    try {
      if (initialData?.id) {
        const updates: Partial<PreferenceNode> = {
          value: data.value,
          active: data.active,
          negated: data.negated,
        };
        await updatePreference(userId, initialData.id, updates);
      } else {
        await addPreference(userId, data);
      }
      onSuccess();
      reset();
    } catch (error) {
      console.error('Failed to save preference:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 p-6 bg-white rounded-lg shadow-md border border-burgundy-200">
      {/* Type Field */}
      <div>
        <label htmlFor="type" className="block text-sm font-medium text-burgundy-800">Preference Type</label>
        <Controller
          name="type"
          control={control}
          rules={{ required: 'Preference type is required' }}
          render={({ field }) => (
            <input
              id="type"
              {...field}
              className={`mt-1 block w-full rounded-md border-burgundy-200 shadow-sm focus:border-burgundy-600 focus:ring-burgundy-600 sm:text-sm ${
                errors.type ? 'border-red-500' : ''
              }`}
            />
          )}
        />
        {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>}
      </div>

      {/* Value Field */}
      <div>
        <label htmlFor="value" className="block text-sm font-medium text-burgundy-800">Preference Value</label>
        {selectedType === 'wineType' || selectedType === 'sweetness' || selectedType === 'body' || selectedType === 'region' ? (
          <Controller
            name="value"
            control={control}
            rules={{ required: 'Preference value is required' }}
            render={({ field }: { field: ControllerRenderProps<PreferenceNode, "value"> }) => (
              <select
                id="value"
                {...field}
                className={`mt-1 block w-full rounded-md border-burgundy-200 shadow-sm focus:border-burgundy-600 focus:ring-burgundy-600 sm:text-sm ${
                  errors.value ? 'border-red-500' : ''
                }`}
                value={String(field.value)}
              >
                <option value="">Select a value</option>
                <option value="red">Red</option>
                <option value="dry">Dry</option>
                <option value="example">Example Option</option>
              </select>
            )}
          />
        ) : selectedType === 'priceRange' ? (
          <Controller
            name="value"
            control={control}
            rules={{ required: 'Preference value is required' }}
            render={({ field }) => (
              <div className="space-y-2">
                <input
                  type="number"
                  placeholder="Min Price"
                  {...field}
                  className={`w-full rounded-md border-burgundy-200 shadow-sm focus:border-burgundy-600 focus:ring-burgundy-600 sm:text-sm ${
                    errors.value ? 'border-red-500' : ''
                  }`}
                  value={Array.isArray(field.value) ? (field.value as number[])[0] || '' : Number(field.value) || ''}
                />
                <input
                  type="number"
                  placeholder="Max Price"
                  {...field}
                  className={`w-full rounded-md border-burgundy-200 shadow-sm focus:border-burgundy-600 focus:ring-burgundy-600 sm:text-sm ${
                    errors.value ? 'border-red-500' : ''
                  }`}
                  value={Array.isArray(field.value) ? (field.value as number[])[1] || '' : ''} // Assuming the second element is max price
                />
              </div>
            )}
          />
        ) : (
          <Controller
            name="value"
            control={control}
            rules={{ required: 'Preference value is required' }}
            render={({ field }) => (
              <input
                id="value"
                {...field}
                className={`mt-1 block w-full rounded-md border-burgundy-200 shadow-sm focus:border-burgundy-600 focus:ring-burgundy-600 sm:text-sm ${
                  errors.value ? 'border-red-500' : ''
                }`}
                value={String(field.value)} // Explicitly convert to string
              />
            )}
          />
        )}
        {errors.value && <p className="mt-1 text-sm text-red-600">{errors.value.message}</p>}
      </div>

      {/* Toggles */}
      <div className="space-y-4">
        <div className="flex items-center">
          <Controller
            name="active"
            control={control}
            render={({ field }: { field: ControllerRenderProps<PreferenceNode, "active"> }) => (
              <input
                type="checkbox"
                className="h-4 w-4 text-burgundy-600 border-burgundy-300 rounded focus:ring-burgundy-600"
                checked={field.value as boolean}
                onChange={field.onChange}
              />
            )}
          />
          <label htmlFor="active" className="ml-2 text-sm text-burgundy-700">Include in Pairing</label>
        </div>

        <div className="flex items-center">
          <Controller
            name="negated"
            control={control}
            render={({ field }: { field: ControllerRenderProps<PreferenceNode, "negated"> }) => (
              <input
                type="checkbox"
                className="h-4 w-4 text-burgundy-600 border-burgundy-300 rounded focus:ring-burgundy-600"
                checked={field.value as boolean}
                onChange={field.onChange}
              />
            )}
          />
          <label htmlFor="negated" className="ml-2 text-sm text-burgundy-700">Negated</label>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-burgundy-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-burgundy-700 bg-white border border-burgundy-200 rounded-md shadow-sm hover:bg-burgundy-50 focus:ring-2 focus:ring-burgundy-600"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-burgundy-600 rounded-md shadow-sm hover:bg-burgundy-700 focus:ring-2 focus:ring-burgundy-600"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Preference'}
        </button>
      </div>
    </form>
  );
};

export default PreferenceForm;
