"use client"; // Mark as a Client Component

import React, { useState, useEffect } from 'react'; // Import necessary hooks
// Import API functions if they are needed directly in this component
// import { getRecommendation } from '../lib/api'; // Assuming an API function for recommendations

const ChatUI: React.FC = () => {
  // TODO: Implement state for user input, conversation history, etc.
  const [userInput, setUserInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const [recommendationSource, setRecommendationSource] = useState('knowledgeGraph'); // Default source
  const [isLoading, setIsLoading] = useState(false); // State for loading indicator

  // TODO: Implement logic to load/save conversation history from sessionStorage
  useEffect(() => {
    // Load history from sessionStorage on component mount
    const savedHistory = sessionStorage.getItem('conversationHistory_test-user'); // Use a consistent key
    if (savedHistory) {
      setConversationHistory(JSON.parse(savedHistory));
    }
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    // Save history to sessionStorage whenever it changes
    sessionStorage.setItem('conversationHistory_test-user', JSON.stringify(conversationHistory));
  }, [conversationHistory]); // Run whenever conversationHistory changes


  // TODO: Implement handleGetRecommendation function
  const handleGetRecommendation = async () => {
    if (!userInput.trim()) {
      alert('Please enter your preferences or ingredients.');
      return;
    }

    setIsLoading(true); // Set loading state

    // Add user input to history
    const newUserTurn = { role: 'user', content: userInput };
    setConversationHistory(prevHistory => [...prevHistory, newUserTurn]);

    // Clear input field
    setUserInput('');

    try {
      // TODO: Replace with actual API call using fetch or a library like axios/SWR
      // Example fetch call (adapt to your actual API endpoint and request structure)
      const response = await fetch('http://localhost:3001/api/recommendations', { // Use backend port 3001
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              userId: 'test-user', // Use a consistent user ID
              input: {
                  message: userInput,
                  recommendationSource: recommendationSource,
              },
              conversationHistory: [...conversationHistory, newUserTurn], // Include the latest user turn
          }),
      });

      const data = await response.json();

      if (response.ok) {
          const assistantResponse = data.recommendation ? data.recommendation : (data.error || 'No recommendation provided.');
          setConversationHistory(prevHistory => [...prevHistory, { role: 'assistant', content: assistantResponse }]);
      } else {
          const errorResponse = data.error || 'Unknown error';
          setConversationHistory(prevHistory => [...prevHistory, { role: 'assistant', content: 'Error: ' + errorResponse }]);
      }
    } catch (error: unknown) { // Use unknown for caught errors
        let errorMessage = 'An unknown error occurred.';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        }
        setConversationHistory(prevHistory => [...prevHistory, { role: 'assistant', content: 'Error: ' + errorMessage }]);
    } finally {
        setIsLoading(false); // Clear loading state
    }
  };

  // TODO: Implement handleClearHistory function
  const handleClearHistory = () => {
    setConversationHistory([]);
    sessionStorage.removeItem('conversationHistory_test-user');
  };

  // Helper function to render conversation turns (basic markdown support)
  const renderConversation = () => {
    return conversationHistory.map((turn, index) => (
      <div key={index} className={`mb-2 ${turn.role === 'user' ? 'text-right' : 'text-left'}`}>
        <strong>{turn.role}:</strong>
        {/* TODO: Implement proper markdown rendering if needed */}
        <div dangerouslySetInnerHTML={{ __html: turn.content.replace(/\\n/g, '<br>') }} /> {/* Basic line breaks */}
      </div>
    ));
  };


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Get a Wine Recommendation</h1>

      <div className="mb-4">
        <input
          type="text"
          id="user-input" // Consider removing ID if not needed for direct DOM manipulation
          placeholder="Enter your preferences or ingredients"
          className="border p-2 mr-2"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => { // Allow sending on Enter key press
            if (e.key === 'Enter') {
              handleGetRecommendation();
            }
          }}
        />
        <button
          id="get-recommendation" // Consider removing ID
          onClick={handleGetRecommendation}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={isLoading} // Disable button while loading
        >
          {isLoading ? 'Getting Recommendation...' : 'Get Recommendation'}
        </button>
        <button
          id="clear-history" // Consider removing ID
          onClick={handleClearHistory}
          className="ml-2 px-4 py-2 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          disabled={isLoading} // Disable while loading
        >
          Clear History
        </button>
      </div>

      <div className="mb-4">
        <label htmlFor="recommendation-source" className="mr-2">Recommendation Source:</label>
        <select
          id="recommendation-source" // Consider removing ID
          className="border p-2"
          value={recommendationSource}
          onChange={(e) => setRecommendationSource(e.target.value)}
          disabled={isLoading} // Disable while loading
        >
          <option value="knowledgeGraph">Knowledge Graph</option>
          <option value="llm">LLM</option>
        </select>
      </div>

      <div id="recommendation-output" className="mt-4 border p-4 rounded"> {/* Consider removing ID */}
        {renderConversation()}
      </div>
    </div>
  );
};

export default ChatUI;