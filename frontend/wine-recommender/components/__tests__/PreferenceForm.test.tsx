import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PreferenceForm from '../PreferenceForm';
import { PreferenceNode } from '../../../../src/types';
import { addPreference, updatePreference } from '../../lib/api';

// Mock the API functions
jest.mock('../../lib/api', () => ({
  addPreference: jest.fn(),
  updatePreference: jest.fn(),
}));

const mockAddPreference = addPreference as jest.Mock;
const mockUpdatePreference = updatePreference as jest.Mock;

describe('PreferenceForm', () => {
  const mockUserId = 'test-user';
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    // Reset mocks before each test
    mockAddPreference.mockClear();
    mockUpdatePreference.mockClear();
    mockOnSuccess.mockClear();
    mockOnCancel.mockClear();
  });

  it('should render the form for adding a new preference', () => {
    render(
      <PreferenceForm
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText('Preference Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Preference Value')).toBeInTheDocument();
    // TODO: Expect the active toggle to be present once implemented
    expect(screen.getByRole('button', { name: 'Save Preference' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Preference' })).not.toBeDisabled(); // Should not be submitting initially
  });

  it('should render the form for editing an existing preference with initial data', () => {
    const mockPreference: PreferenceNode = {
      id: 'pref-123',
      type: 'wineType',
      value: 'red',
      source: 'manual',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
      active: true,
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
    expect(screen.getByLabelText('Preference Value')).toHaveValue('red');
    // TODO: Expect the active toggle to be checked once implemented
    expect(screen.getByRole('button', { name: 'Save Preference' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should submit the form to add a new preference', async () => {
    render(
      <PreferenceForm
        userId={mockUserId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const typeInput = screen.getByLabelText('Preference Type');
    const valueInput = screen.getByLabelText('Preference Value');
    const saveButton = screen.getByRole('button', { name: 'Save Preference' });

    // Simulate user input
    fireEvent.change(typeInput, { target: { value: 'flavor' } });
    fireEvent.change(valueInput, { target: { value: 'oaky' } });

    // Mock the API call to resolve
    mockAddPreference.mockResolvedValue(undefined);

    // Submit the form
    fireEvent.click(saveButton);

    // Expect addPreference to have been called with the correct data
    await waitFor(() => {
      expect(mockAddPreference).toHaveBeenCalledWith(mockUserId, {
        type: 'flavor',
        value: 'oaky',
        source: 'manual', // Default source
        confidence: 1.0, // Default confidence
        timestamp: expect.any(String), // Expect a timestamp string
        active: true, // Default active state
      });
    });

    // Expect onSuccess to have been called
    expect(mockOnSuccess).toHaveBeenCalled();
    // Expect the form to be reset (check input values)
    expect(typeInput).toHaveValue('');
    expect(valueInput).toHaveValue('');
    // TODO: Check active toggle state after reset
  });

it('should submit the form to edit an existing preference', async () => {
  const mockPreference: PreferenceNode = {
    id: 'pref-123',
    type: 'wineType',
    value: 'red',
    source: 'manual',
    confidence: 1.0,
    timestamp: new Date().toISOString(),
    active: true,
  };

  render(
    <PreferenceForm
      initialData={mockPreference}
      userId={mockUserId}
      onSuccess={mockOnSuccess}
      onCancel={mockOnCancel}
    />
  );

  const typeInput = screen.getByLabelText('Preference Type');
  const valueInput = screen.getByLabelText('Preference Value');
  const saveButton = screen.getByRole('button', { name: 'Save Preference' });

  // Simulate user changing the value
  fireEvent.change(valueInput, { target: { value: 'bold red' } });

  // Mock the API call to resolve
  mockUpdatePreference.mockResolvedValue(undefined);

  // Submit the form
  fireEvent.click(saveButton);

  // Expect updatePreference to have been called with the correct data, including the ID
  await waitFor(() => {
    expect(mockUpdatePreference).toHaveBeenCalledWith(mockUserId, mockPreference.id, {
      ...mockPreference, // Expect initial data...
      value: 'bold red', // ...with the updated value
      // TODO: Verify other fields are included correctly, especially active toggle state
    });
  });

  // Expect onSuccess to have been called
  expect(mockOnSuccess).toHaveBeenCalled();
  // Expect the form to be reset (check input values)
  expect(typeInput).toHaveValue('');
  expect(valueInput).toHaveValue('');
  // TODO: Check active toggle state after reset
});

it('should call onCancel when the Cancel button is clicked', () => {
  render(
    <PreferenceForm
      userId={mockUserId}
      onSuccess={mockOnSuccess}
      onCancel={mockOnCancel}
    />
  );

  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  fireEvent.click(cancelButton);

  // Expect onCancel to have been called
  expect(mockOnCancel).toHaveBeenCalled();
});

it('should handle API errors during form submission', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Mock console.error
  const mockError = new Error('Submission failed');
  // Mock both API calls to reject with an error
  mockAddPreference.mockRejectedValue(mockError);
  mockUpdatePreference.mockRejectedValue(mockError);

  render(
    <PreferenceForm
      userId={mockUserId}
      onSuccess={mockOnSuccess}
      onCancel={mockOnCancel}
    />
  );

  const typeInput = screen.getByLabelText('Preference Type');
  const valueInput = screen.getByLabelText('Preference Value');
  const saveButton = screen.getByRole('button', { name: 'Save Preference' });

  // Simulate user input
  fireEvent.change(typeInput, { target: { value: 'flavor' } });
  fireEvent.change(valueInput, { target: { value: 'oaky' } });

  // Submit the form
  fireEvent.click(saveButton);

  // Expect console.error to have been called
  await waitFor(() => {
    expect(consoleSpy).toHaveBeenCalledWith('Failed to save preference:', mockError);
  });
  // Expect onSuccess not to have been called
  expect(mockOnSuccess).not.toHaveBeenCalled();
  // Expect the save button to be re-enabled
  expect(saveButton).not.toBeDisabled();

  consoleSpy.mockRestore(); // Restore console.error
});

it('should display validation errors for missing required fields', async () => {
  render(
    <PreferenceForm
      userId={mockUserId}
      onSuccess={mockOnSuccess}
      onCancel={mockOnCancel}
    />
  );

  const saveButton = screen.getByRole('button', { name: 'Save Preference' });

  // Submit the form without filling in required fields
  fireEvent.click(saveButton);

  // Expect validation error messages to be displayed
  await waitFor(() => {
    expect(screen.getByText('Preference type is required')).toBeInTheDocument();
    expect(screen.getByText('Preference value is required')).toBeInTheDocument();
  });

  // Expect API functions not to have been called
  expect(mockAddPreference).not.toHaveBeenCalled();
  expect(mockUpdatePreference).not.toHaveBeenCalled();
  expect(mockOnSuccess).not.toHaveBeenCalled();
});

it('should include the active toggle value in the submitted data', async () => {
  render(
    <PreferenceForm
      userId={mockUserId}
      onSuccess={mockOnSuccess}
      onCancel={mockOnCancel}
    />
  );

  const typeInput = screen.getByLabelText('Preference Type');
  const valueInput = screen.getByLabelText('Preference Value');
  const activeToggle = screen.getByLabelText('Include in Pairing') as HTMLInputElement; // Assuming the label text and input type
  const saveButton = screen.getByRole('button', { name: 'Save Preference' });

  // Simulate user input
  fireEvent.change(typeInput, { target: { value: 'region' } });
  fireEvent.change(valueInput, { target: { value: 'Barossa' } });
  // Toggle the active state
  fireEvent.click(activeToggle); // Assuming it defaults to true and we toggle it off

  // Mock the API call to resolve
  mockAddPreference.mockResolvedValue(undefined);

  // Submit the form
  fireEvent.click(saveButton);

  // Expect addPreference to have been called with the correct data, including active: false
  await waitFor(() => {
    expect(mockAddPreference).toHaveBeenCalledWith(mockUserId, {
      type: 'region',
      value: 'Barossa',
      source: 'manual',
      confidence: 1.0,
      timestamp: expect.any(String),
      active: false, // Expect active to be false after toggling
    });
  });

  expect(mockOnSuccess).toHaveBeenCalled();
});

// TODO: Add tests for different value types (requires component implementation)
});