import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PreferenceForm from '../PreferenceForm';
import { PreferenceNode } from '../../../../backend/types'; // Adjust import path as needed
import { addPreference, updatePreference } from '../../lib/api'; // Import API functions to mock

// Mock the API functions
jest.mock('../../lib/api', () => ({
  addPreference: jest.fn(),
  updatePreference: jest.fn(),
}));

const mockedAddPreference = addPreference as jest.Mock;
const mockedUpdatePreference = updatePreference as jest.Mock;

describe('PreferenceForm', () => {
  const mockUserId = 'test-user-id';
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    // Reset mocks before each test
    mockedAddPreference.mockReset();
    mockedUpdatePreference.mockReset();
    mockOnSuccess.mockReset();
    mockOnCancel.mockReset();
  });

  it('renders correctly for adding a new preference', () => {
    render(
      <PreferenceForm
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText('Preference Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Preference Value')).toBeInTheDocument();
    expect(screen.getByLabelText('Include in Pairing')).toBeInTheDocument();
    expect(screen.getByLabelText('Negated')).toBeInTheDocument(); // Check for negated toggle
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Preference' })).toBeInTheDocument();
  });

  it('renders correctly for editing an existing preference', () => {
    const mockPreference: PreferenceNode = {
      id: '1',
      type: 'wineType',
      value: 'red',
      source: 'manual',
      confidence: 1,
      timestamp: '',
      active: true,
      negated: false,
    };

    render(
      <PreferenceForm
        initialData={mockPreference}
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText('Preference Type')).toHaveValue('wineType');
    // The value input will be dynamic, so check the rendered input based on type
    // For 'wineType', it's currently a default text input in the component before dynamic rendering is fully implemented
    // Once dynamic rendering is complete, this test will need to be updated to check the correct input type and value
    expect(screen.getByLabelText('Preference Value')).toHaveValue('red');
    expect(screen.getByLabelText('Include in Pairing')).toBeChecked();
    expect(screen.getByLabelText('Negated')).not.toBeChecked(); // Check for negated toggle state
    expect(screen.getByRole('button', { name: 'Save Preference' })).toBeInTheDocument();
  });

  it('handles form submission for adding a new preference', async () => {
    mockedAddPreference.mockResolvedValue(undefined); // Mock successful add

    render(
      <PreferenceForm
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Fill out the form (using the default text inputs for now)
    fireEvent.change(screen.getByLabelText('Preference Type'), { target: { value: 'sweetness' } });
    fireEvent.change(screen.getByLabelText('Preference Value'), { target: { value: 'dry' } });
    fireEvent.click(screen.getByLabelText('Include in Pairing')); // Toggle active off
    fireEvent.click(screen.getByLabelText('Negated')); // Toggle negated on


    fireEvent.click(screen.getByRole('button', { name: 'Save Preference' }));

    await waitFor(() => {
      expect(mockedAddPreference).toHaveBeenCalledWith(mockUserId, {
        type: 'sweetness',
        value: 'dry',
        source: 'manual',
        confidence: 1.0,
        timestamp: expect.any(String),
        active: false,
        negated: true,
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('handles form submission for editing an existing preference', async () => {
    const mockPreference: PreferenceNode = {
      id: '1',
      type: 'wineType',
      value: 'red',
      source: 'manual',
      confidence: 1,
      timestamp: '',
      active: true,
      negated: false,
    };
    mockedUpdatePreference.mockResolvedValue(undefined); // Mock successful update

    render(
      <PreferenceForm
        initialData={mockPreference}
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Change some values
    fireEvent.change(screen.getByLabelText('Preference Value'), { target: { value: 'dry' } });
    fireEvent.click(screen.getByLabelText('Include in Pairing')); // Toggle active off
    fireEvent.click(screen.getByLabelText('Negated')); // Toggle negated on


    fireEvent.click(screen.getByRole('button', { name: 'Save Preference' }));

    await waitFor(() => {
      expect(mockedUpdatePreference).toHaveBeenCalledWith(mockUserId, mockPreference.id, {
        value: 'dry', // Value is updated
        active: false, // Toggled off
        negated: true, // Toggled on
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onCancel when the Cancel button is clicked', () => {
    render(
      <PreferenceForm
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('renders select input for wineType and handles selection', async () => {
    render(
      <PreferenceForm
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Change type to wineType
    fireEvent.change(screen.getByLabelText('Preference Type'), { target: { value: 'wineType' } });

    // Wait for the select input to appear
    const valueSelect = await screen.findByLabelText('Preference Value');
    expect(valueSelect).toBeInTheDocument();
    expect(valueSelect.tagName).toBe('SELECT');

    // TODO: Add options to the select in the component and test selecting an option
    // For now, just test that the select is rendered.
  });

  it('renders number inputs for priceRange and handles input', async () => {
    render(
      <PreferenceForm
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Change type to priceRange
    fireEvent.change(screen.getByLabelText('Preference Type'), { target: { value: 'priceRange' } });

    // Wait for the number inputs to appear
    const minPriceInput = await screen.findByPlaceholderText('Min Price');
    const maxPriceInput = await screen.findByPlaceholderText('Max Price');
    expect(minPriceInput).toBeInTheDocument();
    expect(maxPriceInput).toBeInTheDocument();
    expect(minPriceInput).toHaveAttribute('type', 'number');
    expect(maxPriceInput).toHaveAttribute('type', 'number');

    // Enter values
    fireEvent.change(minPriceInput, { target: { value: '10' } });
    fireEvent.change(maxPriceInput, { target: { value: '50' } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Save Preference' }));

    await waitFor(() => {
      expect(mockedAddPreference).toHaveBeenCalledWith(mockUserId, {
        type: 'priceRange',
        value: [10, 50],
        source: 'manual',
        confidence: 1.0,
        timestamp: expect.any(String),
        active: true,
        negated: false,
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('renders number input for alcoholContent and handles input', async () => {
    render(
      <PreferenceForm
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Change type to alcoholContent
    fireEvent.change(screen.getByLabelText('Preference Type'), { target: { value: 'alcoholContent' } });

    // Wait for the number input to appear
    const alcoholInput = await screen.findByLabelText('Preference Value');
    expect(alcoholInput).toBeInTheDocument();
    expect(alcoholInput).toHaveAttribute('type', 'number');

    // Enter value
    fireEvent.change(alcoholInput, { target: { value: '14.5' } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: 'Save Preference' }));

    await waitFor(() => {
      expect(mockedAddPreference).toHaveBeenCalledWith(mockUserId, {
        type: 'alcoholContent',
        value: '14.5', // Component converts to string
        source: 'manual',
        confidence: 1.0,
        timestamp: expect.any(String),
        active: true,
        negated: false,
      });
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('displays validation errors for required fields on submission', async () => {
    render(
      <PreferenceForm
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Submit empty form
    fireEvent.click(screen.getByRole('button', { name: 'Save Preference' }));

    await waitFor(() => {
      expect(screen.getByText('Preference type is required')).toBeInTheDocument();
      expect(screen.getByText('Preference value is required')).toBeInTheDocument();
      expect(mockedAddPreference).not.toHaveBeenCalled(); // API should not be called
    });
  });

  // TODO: Add more tests for type-specific validation (e.g., price range format, alcohol content range)
  // TODO: Add tests for error handling and showing user feedback
});