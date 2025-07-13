import React, { useState, useEffect, useRef } from 'react';
import { Box, VStack, HStack, Input, Button, Text, Flex, Spinner, Center } from '@chakra-ui/react';
import { v4 as uuidv4 } from 'uuid'; // For generating unique user IDs
import { FinalRecommendationPayload, WineRecommendationOutput, GrapeVariety } from '../interfaces'; // Import new interfaces
import AdminPreferenceForm from './AdminPreferenceForm'; // Import the new component

import AdminPreferenceTable from './AdminPreferenceTable'; // Import the new component
import AdminConfirmationDialog from './AdminConfirmationDialog';

interface Message {
  id: string; // Changed to string for UUID
  text?: string; // Make text optional
  component?: React.ReactNode; // New field for React components
  sender: 'user' | 'assistant'; // Changed 'bot' to 'assistant' to match backend DTO
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false); // New state for admin mode
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false); // State for confirmation dialog
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null); // State to store pending confirmation data
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate a unique user ID on component mount if not already present
    if (!localStorage.getItem('chatUserId')) {
      const newUserId = uuidv4();
      localStorage.setItem('chatUserId', newUserId);
      setUserId(newUserId);
    } else {
      setUserId(localStorage.getItem('chatUserId') as string);
    }
  }, []);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001'); // Connect to the WebSocket server

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        console.log('Received WebSocket message:', data);
        const botMessage: Message = {
          id: uuidv4(),
          text: `[${data.agent}]: ${data.message}`, // Display agent and message
          sender: 'assistant',
        };
        setMessages((prevMessages) => [...prevMessages, botMessage]);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close(); // Clean up WebSocket connection on component unmount
    };
  }, []); // Empty dependency array to run only once on mount

  useEffect(() => {
    // Scroll to the bottom of the messages container
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputText.trim() === '' || !userId) return;

    let currentInputText = inputText;
    let targetEndpoint = `${API_BASE_URL}/recommendations`;

    // Check for admin command prefix
    if (currentInputText.startsWith('/admin ')) {
      setIsAdminMode(true);
      currentInputText = currentInputText.substring('/admin '.length); // Remove prefix
      targetEndpoint = `${API_BASE_URL}/admin-commands`; // New endpoint for admin commands
    } else if (currentInputText.toLowerCase() === '/exitadmin') {
      setIsAdminMode(false);
      setInputText('');
      setMessages((prevMessages) => [...prevMessages, { id: uuidv4(), text: 'Exited admin mode.', sender: 'assistant' }]);
      return;
    } else if (isAdminMode) {
      targetEndpoint = `${API_BASE_URL}/admin-commands`; // If already in admin mode, send to admin endpoint
    }

    const newUserMessage: Message = {
      id: uuidv4(),
      text: currentInputText, // Use currentInputText
      sender: 'user',
    };
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Prepare conversation history for the backend
      const conversationHistory = messages.map(msg => ({
        role: msg.sender,
        content: msg.text,
      }));

      const response = await fetch(targetEndpoint, { // Use targetEndpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          input: {
            message: currentInputText, // Use currentInputText
          },
          conversationHistory: [...conversationHistory, { role: 'user', content: currentInputText }], // Include current user message in history sent to backend
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
 
       let responseData: any;
       try {
         responseData = await response.json();
       } catch (jsonError) {
         // If response is not JSON, treat it as plain text
         responseData = await response.text();
       }

       let botResponseText: string;

       if (targetEndpoint === `${API_BASE_URL}/admin-commands`) {
         // Handle admin command responses
         if (typeof responseData === 'object') {
           botResponseText = JSON.stringify(responseData, null, 2); // Pretty print JSON objects
         } else {
           botResponseText = responseData; // Plain text response
         }
       } else {
         // Original logic for wine recommendations
         const data: FinalRecommendationPayload = responseData; // Cast to expected type
         botResponseText = 'No specific recommendation found.';
         if (data.explanation) {
           botResponseText = data.explanation;
         }

         if (data.primaryRecommendation && data.primaryRecommendation.name) {
           botResponseText += `\n\nPrimary Recommendation: ${data.primaryRecommendation.name}`;
           if (data.primaryRecommendation.grapeVarieties && data.primaryRecommendation.grapeVarieties.length > 0) {
             const grapes = data.primaryRecommendation.grapeVarieties.map((g: GrapeVariety) => `${g.name} (${g.percentage}%)`).join(', ');
             botResponseText += ` (${grapes})`;
           }
         }

         if (data.alternatives && data.alternatives.length > 0) {
           botResponseText += '\n\nAlternatives:';
           data.alternatives.forEach((alt: WineRecommendationOutput) => {
             botResponseText += `\n- ${alt.name}`;
             if (alt.grapeVarieties && alt.grapeVarieties.length > 0) {
               const grapes = alt.grapeVarieties.map((g: GrapeVariety) => `${g.name} (${g.percentage}%)`).join(', ');
               botResponseText += ` (${grapes})`;
             }
           });
         }
       }

      let botMessage: Message;

      if (targetEndpoint === `${API_BASE_URL}/admin-commands`) {
        if (Array.isArray(responseData)) {
          // If it's an admin command and the response is an array (e.g., from 'view' or successful 'add'/'update')
          botMessage = {
            id: uuidv4(),
            component: <AdminPreferenceTable preferences={responseData} />,
            sender: 'assistant',
          };
        } else if (typeof responseData === 'object' && responseData !== null && responseData.message && (responseData.message.includes('added') || responseData.message.includes('updated') || responseData.message.includes('deleted'))) {
          // If it's a success message for add/update/delete, display the message
          botMessage = {
            id: uuidv4(),
            text: responseData.message,
            sender: 'assistant',
          };
        } else {
          // Default to text message for other admin responses (e.g., errors)
          botMessage = {
            id: uuidv4(),
            text: botResponseText,
            sender: 'assistant',
          };
        }
      } else {
        // Original logic for wine recommendations
        const data: FinalRecommendationPayload = responseData; // Cast to expected type
        botResponseText = 'No specific recommendation found.';
        if (data.explanation) {
          botResponseText = data.explanation;
        }

        if (data.primaryRecommendation && data.primaryRecommendation.name) {
          botResponseText += `\n\nPrimary Recommendation: ${data.primaryRecommendation.name}`;
          if (data.primaryRecommendation.grapeVarieties && data.primaryRecommendation.grapeVarieties.length > 0) {
            const grapes = data.primaryRecommendation.grapeVarieties.map((g: GrapeVariety) => `${g.name} (${g.percentage}%)`).join(', ');
            botResponseText += ` (${grapes})`;
          }
        }

        if (data.alternatives && data.alternatives.length > 0) {
          botResponseText += '\n\nAlternatives:';
          data.alternatives.forEach((alt: WineRecommendationOutput) => {
            botResponseText += `\n- ${alt.name}`;
            if (alt.grapeVarieties && alt.grapeVarieties.length > 0) {
              const grapes = alt.grapeVarieties.map((g: GrapeVariety) => `${g.name} (${g.percentage}%)`).join(', ');
              botResponseText += ` (${grapes})`;
            }
          });
        }
        botMessage = {
          id: uuidv4(),
          text: botResponseText,
          sender: 'assistant',
        };
      }
      setMessages((prevMessages) => [...prevMessages, botMessage]);

    } catch (error: any) { // Explicitly type error as any for easier access to message property
      console.error('Error sending message to backend:', error);
      const errorMessage: Message = {
        id: uuidv4(),
        text: `Error: ${error.message || 'Could not connect to the service.'}`,
        sender: 'assistant',
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setShowConfirmationDialog(false);
    setIsLoading(true);
    try {
      // Construct the command to send back to the backend for actual deletion
      let confirmCommand = `/confirm_delete ${pendingConfirmation.userId}`;
      if (pendingConfirmation.preferenceType && pendingConfirmation.preferenceValue) {
        confirmCommand += ` type:${pendingConfirmation.preferenceType} value:${pendingConfirmation.preferenceValue}`;
      } else if (pendingConfirmation.preferenceId) {
        confirmCommand += ` id:${pendingConfirmation.preferenceId}`;
      } else {
        confirmCommand += ` all`;
      }

      const response = await fetch(`${API_BASE_URL}/admin-commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingConfirmation.userId,
          input: { message: confirmCommand },
          conversationHistory: [], // Or pass relevant history
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const botMessage: Message = {
        id: uuidv4(),
        text: data.message || 'Deletion confirmed.',
        sender: 'assistant',
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
    } catch (error: any) {
      console.error('Error confirming deletion:', error);
      const errorMessage: Message = {
        id: uuidv4(),
        text: `Error confirming deletion: ${error.message || 'Unknown error.'}`,
        sender: 'assistant',
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
      setPendingConfirmation(null);
    }
  };

  return (
    <>
      <Flex direction="column"
        minH={{ base: "60vh", md: "70vh" }} // Responsive min-height
        maxH={{ base: "80vh", md: "90vh" }} // Responsive max-height
        w="100%"
        maxW={{ base: "95%", md: "md", lg: "lg" }} // Responsive max-width
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        mx="auto" // Center the component
      >
        {isAdminMode && (
          <Box bg="purple.500" color="white" p={2} textAlign="center">
            Admin Mode Active
          </Box>
        )}
        <VStack spacing={4} align="stretch" p={4} flex="1" overflowY="auto">
          {messages.map((message) => (
            <Box
              key={message.id}
              alignSelf={message.sender === 'user' ? 'flex-end' : 'flex-start'}
              bg={message.sender === 'user' ? 'blue.500' : 'gray.200'}
              color={message.sender === 'user' ? 'white' : 'black'}
              borderRadius="lg"
              p={3}
              maxW="70%"
            >
              {message.text && <Text>{message.text}</Text>}
              {message.component && message.component}
            </Box>
          ))}
          {isLoading && (
            <Center>
              <Spinner size="md" />
            </Center>
          )}
          <div ref={messagesEndRef} />
        </VStack>
        <HStack p={4} borderTopWidth="1px">
          <Input
            placeholder="Type your message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage();
              }
            }}
            isDisabled={isLoading}
          />
          <Button colorScheme="blue" onClick={handleSendMessage} isDisabled={isLoading}>
            Send
          </Button>
        </HStack>
      </Flex>
      {showConfirmationDialog && pendingConfirmation && (
        <AdminConfirmationDialog
          isOpen={showConfirmationDialog}
          onClose={() => setShowConfirmationDialog(false)}
          onConfirm={handleConfirmDelete}
          message={pendingConfirmation.message}
          header="Confirm Deletion"
        />
      )}
    </>
  );
};

export default Chatbot;