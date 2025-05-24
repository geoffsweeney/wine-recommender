"use client"; // Mark as a Client Component

import React, { useState, useEffect } from 'react'; // Import necessary hooks
// Import API functions if they are needed directly in this component
// import { getRecommendation } from '../lib/api'; // Assuming an API function for recommendations

const ChatUI: React.FC = () => {
  // TODO: Implement state for user input, conversation history, etc.
  const [userInput, setUserInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const [recommendationSource, setRecommendationSource] = useState('llm'); // Default source
  const [isLoading, setIsLoading] = useState(false); // State for loading indicator
  const [agentConversation, setAgentConversation] = useState<{ agent: string; message: string }[]>([]); // State for agent conversation history
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

  // TODO: Implement WebSocket connection for agent conversation updates
  useEffect(() => {
    const wsUrl = 'ws://localhost:3001/ws/agent-conversation'; // Placeholder URL
    const websocket = new WebSocket(wsUrl);

    websocket.onmessage = (event) => {
      // Assuming the backend sends messages in a specific format, e.g., JSON { agent: 'AgentName', message: '...' }
      try {
        const agentMessage = JSON.parse(event.data);
        setAgentConversation(prevHistory => [...prevHistory, agentMessage]);
      } catch (error) {
        console.error('Failed to parse agent message:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      // TODO: Handle WebSocket errors in the UI
    };

    websocket.onclose = (event) => {
      console.log('WebSocket closed:', event);
      // TODO: Handle WebSocket closure in the UI, maybe attempt to reconnect
    };

    // Clean up the WebSocket connection when the component unmounts
    return () => {
      websocket.close();
    };
  }, []); // Empty dependency array means this runs once on mount

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
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-md border border-burgundy-200">
      <h2 className="text-2xl font-bold text-burgundy-800 mb-6">Get a Wine Recommendation</h2>

      <div className="mb-6 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
        <input
          type="text"
          placeholder="Enter your preferences or ingredients..."
          className="flex-grow border border-burgundy-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-burgundy-600 focus:border-transparent text-burgundy-800 placeholder-burgundy-400"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleGetRecommendation();
            }
          }}
        />
        <button
          onClick={handleGetRecommendation}
          className="px-6 py-3 text-base font-medium text-white bg-burgundy-600 border border-transparent rounded-md shadow-sm hover:bg-burgundy-700 focus:outline-none focus:ring-2 focus:ring-burgundy-600 focus:ring-offset-2 transition duration-150 ease-in-out"
          disabled={isLoading}
        >
          {isLoading ? 'Getting Recommendation...' : 'Get Recommendation'}
        </button>
        <button
          onClick={handleClearHistory}
          className="px-6 py-3 text-base font-medium text-burgundy-700 bg-white border border-burgundy-300 rounded-md shadow-sm hover:bg-burgundy-50 focus:outline-none focus:ring-2 focus:ring-burgundy-600 focus:ring-offset-2 transition duration-150 ease-in-out"
          disabled={isLoading}
        >
          Clear History
        </button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
        <label htmlFor="recommendation-source" className="text-burgundy-800 font-medium">Recommendation Source:</label>
        <select
          id="recommendation-source"
          className="border border-burgundy-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-burgundy-600 focus:border-transparent text-burgundy-800"
          value={recommendationSource}
          onChange={(e) => setRecommendationSource(e.target.value)}
          disabled={isLoading}
        >
          <option value="knowledgeGraph">Knowledge Graph</option>
          <option value="llm">LLM</option>
        </select>
      </div>

      <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6 mt-6">
        {/* User Conversation */}
        <div id="recommendation-output" className="flex-1 border border-burgundy-300 p-8 rounded-md bg-burgundy-50 overflow-y-auto h-64">
          {renderConversation()}
        </div>

        {/* Agent Conversation */}
        <div className="flex-1 border border-burgundy-300 p-4 rounded-md bg-burgundy-50 overflow-y-auto h-64"> {/* Adjusted height */}
          <h3 className="text-lg font-semibold text-burgundy-800 mb-2">Agent Conversation:</h3>
          {agentConversation.map((turn, index) => (
            <div key={index} className="mb-2 text-sm text-burgundy-700">
              <strong>{turn.agent}:</strong> {turn.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatUI;