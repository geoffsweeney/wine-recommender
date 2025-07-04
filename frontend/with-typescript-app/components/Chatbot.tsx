import React, { useState, useEffect, useRef } from 'react';
import { Box, VStack, HStack, Input, Button, Text, Flex, Spinner, Center } from '@chakra-ui/react';
import { v4 as uuidv4 } from 'uuid'; // For generating unique user IDs

interface Message {
  id: string; // Changed to string for UUID
  text: string;
  sender: 'user' | 'assistant'; // Changed 'bot' to 'assistant' to match backend DTO
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

    const newUserMessage: Message = {
      id: uuidv4(),
      text: inputText,
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

      const response = await fetch(`${API_BASE_URL}/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          input: {
            message: inputText,
          },
          conversationHistory: [...conversationHistory, { role: 'user', content: inputText }], // Include current user message in history sent to backend
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // The backend returns the recommendation directly in the data object
      let botResponseText = 'No specific recommendation found.';
      if (data.explanation) {
        botResponseText = data.explanation;
      }

      if (data.primaryRecommendation && data.primaryRecommendation.name) {
        botResponseText += `\n\nPrimary Recommendation: ${data.primaryRecommendation.name}`;
        if (data.primaryRecommendation.grapeVarieties && data.primaryRecommendation.grapeVarieties.length > 0) {
          const grapes = data.primaryRecommendation.grapeVarieties.map((g: any) => `${g.name} (${g.percentage}%)`).join(', ');
          botResponseText += ` (${grapes})`;
        }
      }

      if (data.alternatives && data.alternatives.length > 0) {
        botResponseText += '\n\nAlternatives:';
        data.alternatives.forEach((alt: any) => {
          botResponseText += `\n- ${alt.name}`;
          if (alt.grapeVarieties && alt.grapeVarieties.length > 0) {
            const grapes = alt.grapeVarieties.map((g: any) => `${g.name} (${g.percentage}%)`).join(', ');
            botResponseText += ` (${grapes})`;
          }
        });
      }

      const botMessage: Message = {
        id: uuidv4(),
        text: botResponseText,
        sender: 'assistant',
      };
      setMessages((prevMessages) => [...prevMessages, botMessage]);

    } catch (error) {
      console.error('Error sending message to backend:', error);
      const errorMessage: Message = {
        id: uuidv4(),
        text: 'Error: Could not connect to the recommendation service.',
        sender: 'assistant',
      };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
            <Text>{message.text}</Text>
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
  );
};

export default Chatbot;