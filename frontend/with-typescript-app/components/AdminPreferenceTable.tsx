import React from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Box,
  Text,
} from '@chakra-ui/react';

interface Preference {
  type: string;
  value: string;
}

interface AdminPreferenceTableProps {
  preferences: Preference[];
}

const AdminPreferenceTable: React.FC<AdminPreferenceTableProps> = ({ preferences }) => {
  if (!preferences || preferences.length === 0) {
    return <Text>No preferences found.</Text>;
  }

  return (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden" my={4}>
      <TableContainer>
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th>Type</Th>
              <Th>Value</Th>
            </Tr>
          </Thead>
          <Tbody>
            {preferences.map((pref, index) => (
              <Tr key={index}>
                <Td>{pref.type}</Td>
                <Td>{pref.value}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AdminPreferenceTable;