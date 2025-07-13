import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  Input,
  Button,
  VStack,
  HStack,
  Text,
} from '@chakra-ui/react';

interface Preference {
  type: string;
  value: string;
}

interface AdminPreferenceFormProps {
  initialPreferences?: Preference[];
  onSubmit: (preferences: Preference[]) => void;
  onCancel: () => void;
}

const AdminPreferenceForm: React.FC<AdminPreferenceFormProps> = ({
  initialPreferences = [{ type: '', value: '' }],
  onSubmit,
  onCancel,
}) => {
  const [preferences, setPreferences] = useState<Preference[]>(initialPreferences);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  const handlePreferenceChange = (index: number, field: keyof Preference, value: string) => {
    const newPreferences = [...preferences];
    newPreferences[index] = { ...newPreferences[index], [field]: value };
    setPreferences(newPreferences);
  };

  const handleAddPreference = () => {
    setPreferences([...preferences, { type: '', value: '' }]);
  };

  const handleRemovePreference = (index: number) => {
    const newPreferences = preferences.filter((_, i) => i !== index);
    setPreferences(newPreferences);
  };

  const handleSubmit = () => {
    const isValid = preferences.every(pref => pref.type.trim() !== '' && pref.value.trim() !== '');
    if (!isValid) {
      setError('All preference type and value fields must be filled.');
      return;
    }
    setError(null);
    onSubmit(preferences);
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} my={4} w="100%">
      <VStack spacing={4} align="stretch">
        {preferences.map((pref, index) => (
          <HStack key={index} spacing={3}>
            <FormControl isRequired>
              <FormLabel>Type</FormLabel>
              <Input
                value={pref.type}
                onChange={(e) => handlePreferenceChange(index, 'type', e.target.value)}
                placeholder="e.g., wineType"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Value</FormLabel>
              <Input
                value={pref.value}
                onChange={(e) => handlePreferenceChange(index, 'value', e.target.value)}
                placeholder="e.g., red"
              />
            </FormControl>
            {preferences.length > 1 && (
              <Button onClick={() => handleRemovePreference(index)} colorScheme="red" size="sm" mt={8}>
                Remove
              </Button>
            )}
          </HStack>
        ))}
        {error && <Text color="red.500">{error}</Text>}
        <Button onClick={handleAddPreference} colorScheme="teal" size="sm">
          Add Another Preference
        </Button>
        <HStack spacing={4}>
          <Button onClick={handleSubmit} colorScheme="blue">
            Submit
          </Button>
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};

export default AdminPreferenceForm;