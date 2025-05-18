import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react'; // Add fireEvent
import '@testing-library/jest-dom';
import useSWR from 'swr';
import PreferenceList from '../PreferenceList';
import { PreferenceNode } from '../../../../src/types';
import { getPreferences } from '../../lib/api';

// Mock the useSWR hook
jest.mock('swr');
const mockUseSWR = useSWR as jest.Mock;

// Mock the API function
jest.mock('../../lib/api', () => ({
  getPreferences: jest.fn(),
}));
const mockGetPreferences = getPreferences as jest.Mock;

// Mock the PreferenceItem component to avoid testing its internals here
jest.mock('../PreferenceItem', () => ({
  __esModule: true,
  default: ({ preference, userId, onPreferenceUpdated, onPreferenceDeleted, onEdit }: any) => (
    <div data-testid={`preference-item-${preference.id || preference.type}`}>
      {preference.type}: {String(preference.value)}
      <button onClick={() => onEdit(preference)}>Edit</button>
      {/* Simulate toggle and delete for completeness if needed later */}
    </div>
  ),
}));


describe('PreferenceList', () => {
  const mockUserId = 'test-user';
  const mockOnEdit = jest.fn();

  beforeEach(() => {
    // Reset mocks before each test
    mockUseSWR.mockClear();
    mockGetPreferences.mockClear();
    mockOnEdit.mockClear();
  });

  it('should show loading state while fetching data', () => {
    // Mock useSWR to return loading state
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined, mutate: jest.fn() });

    render(<PreferenceList userId={mockUserId} onEdit={mockOnEdit} />);

    expect(screen.getByText('Loading preferences...')).toBeInTheDocument();
    expect(mockGetPreferences).toHaveBeenCalledWith(mockUserId);
  });

  it('should show error message if fetching fails', () => {
    const mockError = new Error('Failed to fetch');
    // Mock useSWR to return error state
    mockUseSWR.mockReturnValue({ data: undefined, error: mockError, mutate: jest.fn() });

    render(<PreferenceList userId={mockUserId} onEdit={mockOnEdit} />);

    expect(screen.getByText('Failed to load preferences')).toBeInTheDocument();
    expect(mockGetPreferences).toHaveBeenCalledWith(mockUserId);
  });

  it('should show "No preferences found" if the list is empty', () => {
    // Mock useSWR to return an empty array
    mockUseSWR.mockReturnValue({ data: [], error: undefined, mutate: jest.fn() });

    render(<PreferenceList userId={mockUserId} onEdit={mockOnEdit} />);

    expect(screen.getByText('No preferences found.')).toBeInTheDocument();
    expect(mockGetPreferences).toHaveBeenCalledWith(mockUserId);
  });

  it('should render a list of preferences', () => {
    const mockPreferences: PreferenceNode[] = [
      { id: 'pref-1', type: 'wineType', value: 'red', source: 'manual', confidence: 1.0, timestamp: new Date().toISOString(), active: true },
      { id: 'pref-2', type: 'sweetness', value: 'dry', source: 'llm', confidence: 0.9, timestamp: new Date().toISOString(), active: true },
    ];
    // Mock useSWR to return the list of preferences
    mockUseSWR.mockReturnValue({ data: mockPreferences, error: undefined, mutate: jest.fn() });

    render(<PreferenceList userId={mockUserId} onEdit={mockOnEdit} />);

    // Expect PreferenceItem components to be rendered for each preference
    expect(screen.getByTestId('preference-item-pref-1')).toBeInTheDocument();
    expect(screen.getByTestId('preference-item-pref-2')).toBeInTheDocument();

    // Verify that the correct data is passed to the mocked PreferenceItem components
    // This is implicitly tested by the data-testid, but we can add more explicit checks if needed
    // For example, checking the text content within the mocked item.
    expect(screen.getByText('wineType: red')).toBeInTheDocument();
    expect(screen.getByText('sweetness: dry')).toBeInTheDocument();

    it('should pass the onEdit handler to PreferenceItem', () => {
      const mockPreferences: PreferenceNode[] = [
        { id: 'pref-1', type: 'wineType', value: 'red', source: 'manual', confidence: 1.0, timestamp: new Date().toISOString(), active: true },
      ];
      // Mock useSWR to return the list of preferences
      mockUseSWR.mockReturnValue({ data: mockPreferences, error: undefined, mutate: jest.fn() });
  
      render(<PreferenceList userId={mockUserId} onEdit={mockOnEdit} />);
  
      // Find the Edit button within the mocked PreferenceItem
      const editButton = screen.getByRole('button', { name: 'Edit' });
  
      // Simulate clicking the Edit button
      fireEvent.click(editButton);
  
      // Expect the onEdit handler of PreferenceList to have been called with the correct preference
      expect(mockOnEdit).toHaveBeenCalledWith(mockPreferences[0]);
    });
  });

  // TODO: Add test for passing onEdit handler to PreferenceItem
});