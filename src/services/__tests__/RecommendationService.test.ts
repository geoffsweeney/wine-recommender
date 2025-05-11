import { MockNeo4jService } from '../MockNeo4jService'; // Import the mock service
import { RecommendationService } from '../RecommendationService'; // Assuming this is the service being tested

const mockWines = [
  {
    name: 'Merlot Reserve',
    region: 'Bordeaux',
    price: 45,
    vintage: 2018
  },
  {
    name: 'Chardonnay',
    region: 'Napa Valley', 
    price: 32,
    vintage: 2020
  },
  {
    name: 'Pinot Noir',
    region: 'Burgundy',
    price: 58,
    vintage: 2019
  }
];

const mockNeo4j = new MockNeo4jService(); // Create an instance of the mock service

// Example usage in a test case
test('should execute query and return mock wines', async () => {
    mockNeo4j.executeQuery = jest.fn().mockResolvedValue(mockWines); // Mock the executeQuery method
    const result = await mockNeo4j.executeQuery('MATCH (w:Wine)');
    expect(result).toEqual(mockWines);
});