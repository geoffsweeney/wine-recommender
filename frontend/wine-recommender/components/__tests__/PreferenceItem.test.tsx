import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PreferenceItem from '../PreferenceItem';
import { PreferenceNode } from '../../../../src/types'; // Adjust import path as needed
import { updatePreference, deletePreference } from '../../lib/api'; // Import API functions to mock

// Mock the API functions
jest.mock('../../lib/api', () => ({
  updatePreference: jest.fn(),
  deletePreference: jest.fn(),
}));

const mockedUpdatePreference = updatePreference as jest.Mock;
const mockedDeletePreference = deletePreference as jest.Mock;

describe('PreferenceItem', () => {
  const mockPreference: PreferenceNode = {
    id: '1',
    type: 'wineType',
    value: 'red',
    source: 'manual',
    confidence: 1,
    timestamp: '2023-10-27T10:00:00Z',
    active: true,
    negated: false,
  };
  const mockUserId = 'test-user-id';
  const mockOnPreferenceUpdated = jest.fn();
  const mockOnPreferenceDeleted = jest.fn();
  const mockOnEdit = jest.fn();

  beforeEach(() => {
    // Reset mocks before each test
    mockedUpdatePreference.mockReset();
    mockedDeletePreference.mockReset();
    mockOnPreferenceUpdated.mockReset();
    mockOnPreferenceDeleted.mockReset();
    mockOnEdit.mockReset();
  });

  it('renders preference details correctly', () => {
    render(
      <PreferenceItem
        preference={mockPreference}
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText('Type: wineType')).toBeInTheDocument();
    expect(screen.getByText('Value: red')).toBeInTheDocument();
    expect(screen.getByText('Source: manual')).toBeInTheDocument();
    expect(screen.getByText('Confidence: 1')).toBeInTheDocument();
    expect(screen.getByText('Timestamp: 27/10/2023, 10:00:00 am')).toBeInTheDocument(); // Adjust expected format based on toLocaleString output
    expect(screen.getByText('Negated: No')).toBeInTheDocument();
    expect(screen.getByLabelText('Include in Pairing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('handles array value display correctly', () => {
      const arrayPreference: PreferenceNode = {
          ...mockPreference,
          value: ['fruity', 'spicy'],
          type: 'flavors',
      };
       render(
        <PreferenceItem
          preference={arrayPreference}
          userId={mockUserId}
          onPreferenceUpdated={mockOnPreferenceUpdated}
          onPreferenceDeleted={mockOnPreferenceDeleted}
          onEdit={mockOnEdit}
        />
      );
      expect(screen.getByText('Value: fruity, spicy')).toBeInTheDocument();
  });


  it('handles toggle change and calls updatePreference and onPreferenceUpdated', async () => {
    mockedUpdatePreference.mockResolvedValue(undefined); // Mock successful update

    render(
      <PreferenceItem
        preference={mockPreference}
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    const toggle = screen.getByLabelText('Include in Pairing') as HTMLInputElement;
    expect(toggle.checked).toBe(true); // Initially active

    fireEvent.click(toggle); // Click to toggle off

    // Optimistic update should make it unchecked immediately
    expect(toggle.checked).toBe(false);

    await waitFor(() => {
      expect(mockedUpdatePreference).toHaveBeenCalledWith(mockUserId, mockPreference.id, { active: false });
      expect(mockOnPreferenceUpdated).toHaveBeenCalledTimes(1);
    });
  });

  it('reverts optimistic toggle update and logs error if updatePreference fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Spy on console.error
    mockedUpdatePreference.mockRejectedValue(new Error('Update failed')); // Mock failed update

    render(
      <PreferenceItem
        preference={mockPreference}
        userId={mockUserId}
        onPreferenceUpdated={mockOnPreferenceUpdated}
        onPreferenceDeleted={mockOnPreferenceDeleted}
        onEdit={mockOnEdit}
      />
    );

    const toggle = screen.getByLabelText('Include in Pairing') as HTMLInputElement;
    expect(toggle.checked).toBe(true); // Initially active

    fireEvent.click(toggle); // Click to toggle off

    // Optimistic update
    expect(toggle.checked).toBe(false);

    await waitFor(() => {
      expect(mockedUpdatePreference).toHaveBeenCalledWith(mockUserId, mockPreference.id, { active: false });
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update preference active state:', expect.any(Error));
      expect(toggle.checked).toBe(true); // Optimistic update should be reverted
      expect(mockOnPreferenceUpdated).not.toHaveBeenCalled(); // Parent not notified on failure
    });

    consoleErrorSpy.mockRestore(); // Restore console.error spy
  });


  it('calls onEdit when the Edit button is clicked', () => {
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

    expect(mockOnEdit).toHaveBeenCalledWith(mockPreference);
  });

  it('handles delete click, confirms, calls deletePreference, and onPreferenceDeleted', async () => {
    const windowConfirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true); // Mock window.confirm to return true
    mockedDeletePreference.mockResolvedValue(undefined); // Mock successful delete

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
    fireEvent.click(deleteButton);

    expect(windowConfirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this preference?');

    await waitFor(() => {
      expect(mockedDeletePreference).toHaveBeenCalledWith(mockUserId, mockPreference.id);
      expect(mockOnPreferenceDeleted).toHaveBeenCalledTimes(1);
      expect(deleteButton).not.toBeDisabled(); // Button should not be disabled after successful deletion (state reverts)
      expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveTextContent('Deleting...'); // Text reverts
    });

    windowConfirmSpy.mockRestore(); // Restore window.confirm spy
  });

  it('does not call deletePreference if confirmation is cancelled', async () => {
    const windowConfirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false); // Mock window.confirm to return false

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
    fireEvent.click(deleteButton);

    expect(windowConfirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this preference?');

    await waitFor(() => {
      expect(mockedDeletePreference).not.toHaveBeenCalled();
      expect(mockOnPreferenceDeleted).not.toHaveBeenCalled();
      expect(deleteButton).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveTextContent('Deleting...');
    });

    windowConfirmSpy.mockRestore();
  });

   it('reverts deleting state and logs error if deletePreference fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Spy on console.error
    const windowConfirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true); // Mock window.confirm to return true
    mockedDeletePreference.mockRejectedValue(new Error('Delete failed')); // Mock failed delete

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
    fireEvent.click(deleteButton);

    expect(windowConfirmSpy).toHaveBeenCalledWith('Are you sure you want to delete this preference?');
    expect(deleteButton).toBeDisabled(); // Button should be disabled while deleting
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeInTheDocument(); // Text should change

    await waitFor(() => {
      expect(mockedDeletePreference).toHaveBeenCalledWith(mockUserId, mockPreference.id);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete preference:', expect.any(Error));
      expect(deleteButton).not.toBeDisabled(); // Deleting state should be reverted
      expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveTextContent('Deleting...'); // Text reverts
      expect(mockOnPreferenceDeleted).not.toHaveBeenCalled(); // Parent not notified on failure
    });

    consoleErrorSpy.mockRestore(); // Restore console.error spy
    windowConfirmSpy.mockRestore(); // Restore window.confirm spy
  });
});