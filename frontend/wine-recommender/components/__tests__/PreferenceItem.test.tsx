import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PreferenceItem from '../PreferenceItem';
import { PreferenceNode } from '../../../../src/types';
import { updatePreference, deletePreference } from '../../lib/api';

// Mock the API functions
jest.mock('../../lib/api', () => ({
  updatePreference: jest.fn(),
  deletePreference: jest.fn(),
}));

const mockUpdatePreference = updatePreference as jest.Mock;
const mockDeletePreference = deletePreference as jest.Mock;

describe('PreferenceItem', () => {
  const mockPreference: PreferenceNode = {
    id: 'pref-123',
    type: 'wineType',
    value: 'red',
    source: 'manual',
    confidence: 1.0,
    timestamp: new Date().toISOString(),
    active: true,
  };
  const mockUserId = 'test-user';
  const mockOnPreferenceUpdated = jest.fn();
  const mockOnPreferenceDeleted = jest.fn();
  const mockOnEdit = jest.fn();

  beforeEach(() => {
    // Reset mocks before each test
    mockUpdatePreference.mockClear();
    mockDeletePreference.mockClear();
    mockOnPreferenceUpdated.mockClear();
    mockOnPreferenceDeleted.mockClear();
    mockOnEdit.mockClear();
  });

  it('should render preference details correctly', () => {
    render(
      <PreferenceItem
        preference={mockPreference}
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText('wineType:')).toBeInTheDocument();
    expect(screen.getByText('red')).toBeInTheDocument();
    expect(screen.getByLabelText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('should toggle the active state when the switch is clicked', async () => {
    render(
      <PreferenceItem
        preference={mockPreference}
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    const toggleSwitch = screen.getByLabelText('Active');
    expect(toggleSwitch).toBeChecked(); // Initially active

    fireEvent.click(toggleSwitch); // Click to toggle off

    // Expect updatePreference to be called with active: false
    await waitFor(() => {
      expect(mockUpdatePreference).toHaveBeenCalledWith(mockUserId, mockPreference.id, { active: false });
    });
    // Expect onPreferenceUpdated to be called for revalidation
    expect(mockOnPreferenceUpdated).toHaveBeenCalled();

    // Simulate the state update after successful API call (optimistic update is already in component)
    // Re-render with updated preference if needed, or rely on SWR revalidation in a real scenario
    // For this unit test, we primarily check the API call and callback.

    // Click to toggle on again
    fireEvent.click(toggleSwitch);

    // Expect updatePreference to be called with active: true
    await waitFor(() => {
      expect(mockUpdatePreference).toHaveBeenCalledWith(mockUserId, mockPreference.id, { active: true });
    });
    // Expect onPreferenceUpdated to be called again
    expect(mockOnPreferenceUpdated).toHaveBeenCalledTimes(2);
  });

  it('should call deletePreference and onPreferenceDeleted when delete button is clicked and confirmed', async () => {
    render(
      <PreferenceItem
        preference={mockPreference}
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });

    // Mock window.confirm to return true (user confirms deletion)
    jest.spyOn(window, 'confirm').mockImplementation(() => true);

    fireEvent.click(deleteButton);

    // Expect deletePreference to be called
    await waitFor(() => {
      expect(mockDeletePreference).toHaveBeenCalledWith(mockUserId, mockPreference.id);
    });
    // Expect onPreferenceDeleted to be called for revalidation
    expect(mockOnPreferenceDeleted).toHaveBeenCalled();

    // Restore window.confirm mock
    (window.confirm as jest.Mock).mockRestore();
  });

  it('should not call deletePreference if delete is not confirmed', async () => {
    render(
      <PreferenceItem
        preference={mockPreference}
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });

    // Mock window.confirm to return false (user cancels deletion)
    jest.spyOn(window, 'confirm').mockImplementation(() => false);

    fireEvent.click(deleteButton);

    // Expect deletePreference not to be called
    await waitFor(() => {
      expect(mockDeletePreference).not.toHaveBeenCalled();
    });
    // Expect onPreferenceDeleted not to be called
    expect(mockOnPreferenceDeleted).not.toHaveBeenCalled();

    // Restore window.confirm mock
    (window.confirm as jest.Mock).mockRestore();
  });


  it('should call onEdit with the preference when the edit button is clicked', async () => {
    render(
      <PreferenceItem
        preference={mockPreference}
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    // Expect onEdit to have been called with the preference
    expect(mockOnEdit).toHaveBeenCalledWith(mockPreference);
  });


  it('should log an error and not call updatePreference if preference ID is missing when toggling', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Mock console.error
    const preferenceWithoutId = { ...mockPreference, id: undefined }; // Preference without ID

    render(
      <PreferenceItem
        preference={preferenceWithoutId as any} // Cast to any because id is missing
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    const toggleSwitch = screen.getByLabelText('Active');
    fireEvent.click(toggleSwitch);

    // Expect console.error to have been called
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Preference ID is missing, cannot update.');
    });
    // Expect updatePreference not to be called
    expect(mockUpdatePreference).not.toHaveBeenCalled();
    // Expect onPreferenceUpdated not to be called
    expect(mockOnPreferenceUpdated).not.toHaveBeenCalled();

    consoleSpy.mockRestore(); // Restore console.error
  });

  it('should log an error and not call deletePreference if preference ID is missing when deleting', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Mock console.error
    const preferenceWithoutId = { ...mockPreference, id: undefined }; // Preference without ID

    render(
      <PreferenceItem
        preference={preferenceWithoutId as any} // Cast to any because id is missing
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });

    // Mock window.confirm to return true (user confirms deletion)
    jest.spyOn(window, 'confirm').mockImplementation(() => true);

    fireEvent.click(deleteButton);

    // Expect console.error to have been called
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Preference ID is missing, cannot delete.');
    });
    // Expect deletePreference not to be called
    expect(mockDeletePreference).not.toHaveBeenCalled();
    // Expect onPreferenceDeleted not to be called
    expect(mockOnPreferenceDeleted).not.toHaveBeenCalled();

    // Restore mocks
    consoleSpy.mockRestore();
    (window.confirm as jest.Mock).mockRestore();
  });


  it('should handle API errors when toggling active state', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Mock console.error
    const mockError = new Error('Failed to update');
    mockUpdatePreference.mockRejectedValue(mockError); // Make updatePreference reject

    render(
      <PreferenceItem
        preference={mockPreference}
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    const toggleSwitch = screen.getByLabelText('Active') as HTMLInputElement; // Cast to HTMLInputElement

    fireEvent.click(toggleSwitch); // Click to trigger update

    // Expect console.error to have been called
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to update preference active state:', mockError);
    });
    // Expect onPreferenceUpdated not to be called on error
    expect(mockOnPreferenceUpdated).not.toHaveBeenCalled();
    // TODO: Verify that the toggle state is reverted on error (requires more complex test setup or component changes)

    consoleSpy.mockRestore(); // Restore console.error
  });

  it('should handle API errors when deleting preference', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Mock console.error
    const mockError = new Error('Failed to delete');
    mockDeletePreference.mockRejectedValue(mockError); // Make deletePreference reject

    render(
      <PreferenceItem
        preference={mockPreference}
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    const deleteButton = screen.getByRole('button', { name: 'Delete' });

    // Mock window.confirm to return true (user confirms deletion)
    jest.spyOn(window, 'confirm').mockImplementation(() => true);

    fireEvent.click(deleteButton);

    // Expect console.error to have been called
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to delete preference:', mockError);
    });
    // Expect onPreferenceDeleted not to be called on error
    expect(mockOnPreferenceDeleted).not.toHaveBeenCalled();
    // TODO: Verify that the isDeleting state is reset on error

    // Restore mocks
    consoleSpy.mockRestore();
    (window.confirm as jest.Mock).mockRestore();
  });
});