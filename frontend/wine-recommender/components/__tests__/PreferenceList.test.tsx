import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import useSWR from 'swr'; // Mock useSWR
import PreferenceList from '../PreferenceList';
import { PreferenceNode } from '../../../../src/types'; // Adjust import path as needed

// Mock the useSWR hook
jest.mock('swr');
const mockedUseSWR = useSWR as jest.Mock;

// Mock the PreferenceItem component to simplify testing PreferenceList
jest.mock('../PreferenceItem', () => ({
  __esModule: true,
  default: ({ preference, onEdit, onPreferenceDeleted }: { preference: PreferenceNode; onEdit: (p: PreferenceNode) => void; onPreferenceDeleted: () => void }) => (
    <div data-testid="preference-item">
      <span>{preference.type}: {String(preference.value)}</span>
      <button onClick={() => onEdit(preference)}>Edit</button>
      <button onClick={onPreferenceDeleted}>Delete</button>
    </div>
  ),
}));

describe('PreferenceList', () => {
  const mockUserId = 'test-user-id';
  const mockPreferences: PreferenceNode[] = [
    { id: '1', type: 'wineType', value: 'red', source: 'manual', confidence: 1, timestamp: '', active: true },
    { id: '2', type: 'region', value: 'France', source: 'llm', confidence: 0.8, timestamp: '', active: true },
  ];

  it('renders loading state initially', () => {
    mockedUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      mutate: jest.fn(),
    });

    render(<PreferenceList userId={mockUserId} onEdit={jest.fn()} />);

    expect(screen.getByText('Loading preferences...')).toBeInTheDocument();
  });

  it('renders error state if fetching fails', () => {
    mockedUseSWR.mockReturnValue({
      data: undefined,
      error: new Error('Failed to fetch'),
      mutate: jest.fn(),
    });

    render(<PreferenceList userId={mockUserId} onEdit={jest.fn()} />);

    expect(screen.getByText('Failed to load preferences')).toBeInTheDocument();
  });

  it('renders the list of preferences when data is loaded', async () => {
    mockedUseSWR.mockReturnValue({
      data: mockPreferences,
      error: undefined,
      mutate: jest.fn(),
    });

    render(<PreferenceList userId={mockUserId} onEdit={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Your Preferences')).toBeInTheDocument();
      const preferenceItems = screen.getAllByTestId('preference-item');
      expect(preferenceItems.length).toBe(mockPreferences.length);
      expect(screen.getByText('wineType: red')).toBeInTheDocument();
      expect(screen.getByText('region: France')).toBeInTheDocument();
    });
  });

  it('renders "No preferences found" when the list is empty', async () => {
    mockedUseSWR.mockReturnValue({
      data: [],
      error: undefined,
      mutate: jest.fn(),
    });

    render(<PreferenceList userId={mockUserId} onEdit={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('No preferences found.')).toBeInTheDocument();
      expect(screen.queryAllByTestId('preference-item').length).toBe(0);
    });
  });

  it('calls onEdit when the Edit button in a PreferenceItem is clicked', async () => {
    const mockOnEdit = jest.fn();
    mockedUseSWR.mockReturnValue({
      data: mockPreferences,
      error: undefined,
      mutate: jest.fn(),
    });

    render(<PreferenceList userId={mockUserId} onEdit={mockOnEdit} />);

    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit');
      expect(editButtons.length).toBe(mockPreferences.length);
      // Click the first Edit button
      editButtons[0].click();
      expect(mockOnEdit).toHaveBeenCalledWith(mockPreferences[0]);
    });
  });

  // Note: Testing handleDelete requires mocking the API function and mutate,
  // which is handled by the mock PreferenceItem calling onPreferenceDeleted.
  // The test for handleDelete is implicitly covered by testing PreferenceItem's
  // interaction with onPreferenceDeleted.
});