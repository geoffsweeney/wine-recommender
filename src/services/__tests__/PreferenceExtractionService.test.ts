import { PreferenceExtractionService } from '../PreferenceExtractionService';
import axios from 'axios';

// Mock axios to prevent actual HTTP calls during testing
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PreferenceExtractionService', () => {
  let service: PreferenceExtractionService;

  beforeEach(() => {
    service = new PreferenceExtractionService();
    // Reset mocks before each test
    mockedAxios.post.mockReset();
  });

  describe('extractWithRegex', () => {
    it('should extract wine type and sweetness using regex', () => {
      const userInput = 'I prefer a dry red wine.';
      // @ts-ignore - Accessing private method for testing
      const preferences = service.extractWithRegex(userInput);
      expect(preferences).toEqual({ wineType: 'red', sweetness: 'dry' });
    });

    it('should return null if no regex matches are found', () => {
      const userInput = 'I like cheese.';
      // @ts-ignore - Accessing private method for testing
      const preferences = service.extractWithRegex(userInput);
      expect(preferences).toBeNull();
    });

    it('should handle case-insensitive regex matches', () => {
      const userInput = 'I prefer a SWEET WHITE wine.';
      // @ts-ignore - Accessing private method for testing
      const preferences = service.extractWithRegex(userInput);
      expect(preferences).toEqual({ wineType: 'white', sweetness: 'sweet' });
    });
  });

  describe('extractWithDuckling', () => {
    it('should extract preferences using Duckling', async () => {
      const userInput = 'I want a wine around 20 EUR.';
      const mockDucklingResponse = {
        status: 200,
        data: [
          {
            dim: 'quantity',
            value: { value: 20, unit: 'EUR' },
            text: '20 EUR',
            start: 23,
            end: 29,
          },
        ],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // @ts-ignore - Accessing private method for testing
      const preferences = await service.extractWithDuckling(userInput);
      expect(preferences).toEqual({ priceRange: [20, 20] });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:8000/parse',
        'text=I%20want%20a%20wine%20around%2020%20EUR.&locale=en_AU',
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
    });

    it('should extract price range using Duckling (interval)', async () => {
      const userInput = 'I want a wine between 10 and 30 USD.';
      const mockDucklingResponse = {
        status: 200,
        data: [
          {
            dim: 'interval',
            value: {
              from: { value: 10, unit: 'USD' },
              to: { value: 30, unit: 'USD' },
              type: 'interval'
            },
            text: 'between 10 and 30 USD',
            start: 23,
            end: 44,
          },
        ],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // @ts-ignore - Accessing private method for testing
      const preferences = await service.extractWithDuckling(userInput);
      expect(preferences).toEqual({ priceRange: [10, 30] });
    });

    it('should extract temperature using Duckling', async () => {
      const userInput = 'Serve it at 16 degrees Celsius.';
      const mockDucklingResponse = {
        status: 200,
        data: [
          {
            dim: 'temperature',
            value: { value: 16, unit: 'degree Celsius' },
            text: '16 degrees Celsius',
            start: 12,
            end: 30,
          },
        ],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // @ts-ignore - Accessing private method for testing
      const preferences = await service.extractWithDuckling(userInput);
      expect(preferences).toEqual({ servingTemperature: 16 });
    });

    it('should extract duration using Duckling', async () => {
      const userInput = 'This wine needs 2 years of aging.';
      const mockDucklingResponse = {
        status: 200,
        data: [
          {
            dim: 'duration',
            value: { value: 2, unit: 'year', normalized: { value: 63072000, unit: 'second' } },
            text: '2 years',
            start: 17,
            end: 24,
          },
        ],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // @ts-ignore - Accessing private method for testing
      const preferences = await service.extractWithDuckling(userInput);
      expect(preferences).toEqual({ aging: 2 });
    });

    it('should extract location using Duckling', async () => {
      const userInput = 'I prefer wine from France.';
      const mockDucklingResponse = {
        status: 200,
        data: [
          {
            dim: 'location',
            value: { value: 'France', type: 'country' },
            text: 'France',
            start: 20,
            end: 26,
          },
        ],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // @ts-ignore - Accessing private method for testing
      const preferences = await service.extractWithDuckling(userInput);
      expect(preferences).toEqual({ location: 'France' });
    });

    it('should handle multiple Duckling entities of different dimensions', async () => {
      const userInput = 'A red wine from Italy around 15 EUR.';
      const mockDucklingResponse = {
        status: 200,
        data: [
          {
            dim: 'location',
            value: { value: 'Italy', type: 'country' },
            text: 'Italy',
            start: 15,
            end: 20,
          },
          {
            dim: 'quantity',
            value: { value: 15, unit: 'EUR' },
            text: '15 EUR',
            start: 28,
            end: 34,
          },
        ],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // @ts-ignore - Accessing private method for testing
      const preferences = await service.extractWithDuckling(userInput);
      expect(preferences).toEqual({ location: 'Italy', priceRange: [15, 15] });
    });

    it('should return null if Duckling returns no entities', async () => {
      const userInput = 'I like red wine.';
      const mockDucklingResponse = {
        status: 200,
        data: [],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // @ts-ignore - Accessing private method for testing
      const preferences = await service.extractWithDuckling(userInput);
      expect(preferences).toBeNull();
    });

    it('should return null if Duckling request fails', async () => {
      const userInput = 'Some input.';
      mockedAxios.post.mockRejectedValue(new Error('Network Error'));

      // @ts-ignore - Accessing private method for testing
      const preferences = await service.extractWithDuckling(userInput);
      expect(preferences).toBeNull();
    });
  });

  describe('attemptFastExtraction', () => {
    it('should prioritize Duckling results over Regex results for the same preference type', async () => {
      const userInput = 'I want a red wine (Duckling) and a dry wine (Regex).';
      const mockDucklingResponse = {
        status: 200,
        data: [
          {
            dim: 'wineType', // Assuming Duckling can extract wine type
            value: { value: 'red' },
            text: 'red wine',
            start: 10,
            end: 18,
          },
        ],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // Mock the private regex method to control its output
      // @ts-ignore
      const originalExtractWithRegex = service.extractWithRegex;
      // @ts-ignore
      service.extractWithRegex = jest.fn().mockReturnValue({ wineType: 'dry', sweetness: 'dry' });


      const preferences = await service.attemptFastExtraction(userInput);

      expect(preferences).toEqual({ wineType: 'red', sweetness: 'dry' }); // Duckling's 'red' should be prioritized
      // @ts-ignore
      service.extractWithRegex = originalExtractWithRegex; // Restore original method
    });

    it('should merge results from both Regex and Duckling if keys are different', async () => {
      const userInput = 'I want a red wine and a wine around 20 EUR.';
      const mockDucklingResponse = {
        status: 200,
        data: [
          {
            dim: 'quantity',
            value: { value: 20, unit: 'EUR' },
            text: '20 EUR',
            start: 35,
            end: 41,
          },
        ],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // Mock the private regex method to control its output
      // @ts-ignore
      const originalExtractWithRegex = service.extractWithRegex;
      // @ts-ignore
      service.extractWithRegex = jest.fn().mockReturnValue({ wineType: 'red' });

      const preferences = await service.attemptFastExtraction(userInput);

      expect(preferences).toEqual({ wineType: 'red', priceRange: [20, 20] });
      // @ts-ignore
      service.extractWithRegex = originalExtractWithRegex; // Restore original method
    });

    it('should return null if neither Regex nor Duckling find preferences', async () => {
      const userInput = 'I like cheese.';
      const mockDucklingResponse = {
        status: 200,
        data: [],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // Mock the private regex method to control its output
      // @ts-ignore
      const originalExtractWithRegex = service.extractWithRegex;
      // @ts-ignore
      service.extractWithRegex = jest.fn().mockReturnValue(null);

      const preferences = await service.attemptFastExtraction(userInput);

      expect(preferences).toBeNull();
      // @ts-ignore
      service.extractWithRegex = originalExtractWithRegex; // Restore original method
    });

    it('should handle multiple Duckling entities and merge with Regex', async () => {
      const userInput = 'I want a dry red wine around 25 USD from Australia.';
      const mockDucklingResponse = {
        status: 200,
        data: [
          {
            dim: 'quantity',
            value: { value: 25, unit: 'USD' },
            text: '25 USD',
            start: 23,
            end: 29,
          },
          {
            dim: 'location',
            value: { value: 'Australia', type: 'country' },
            text: 'Australia',
            start: 35,
            end: 44,
          },
        ],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // Mock the private regex method to control its output
      // @ts-ignore
      const originalExtractWithRegex = service.extractWithRegex;
      // @ts-ignore
      service.extractWithRegex = jest.fn().mockReturnValue({ wineType: 'red', sweetness: 'dry' });

      const preferences = await service.attemptFastExtraction(userInput);

      expect(preferences).toEqual({
        wineType: 'red',
        sweetness: 'dry',
        priceRange: [25, 25],
        location: 'Australia',
      });
      // @ts-ignore
      service.extractWithRegex = originalExtractWithRegex; // Restore original method
    });

    it('should handle overlapping preferences from Duckling and Regex, prioritizing Duckling', async () => {
      const userInput = 'I want a sweet white wine from France around 30 EUR.';
      const mockDucklingResponse = {
        status: 200,
        data: [
          {
            dim: 'quantity',
            value: { value: 30, unit: 'EUR' },
            text: '30 EUR',
            start: 45,
            end: 51,
          },
          {
            dim: 'location',
            value: { value: 'France', type: 'country' },
            text: 'France',
            start: 30,
            end: 36,
          },
        ],
      };
      mockedAxios.post.mockResolvedValue(mockDucklingResponse);

      // Mock the private regex method to control its output
      // @ts-ignore
      const originalExtractWithRegex = service.extractWithRegex;
      // @ts-ignore
      service.extractWithRegex = jest.fn().mockReturnValue({ wineType: 'white', sweetness: 'sweet', location: 'Italy' }); // Regex has a conflicting location

      const preferences = await service.attemptFastExtraction(userInput);

      expect(preferences).toEqual({
        wineType: 'white',
        sweetness: 'sweet',
        priceRange: [30, 30],
        location: 'France', // Duckling's location should be prioritized
      });
      // @ts-ignore
      service.extractWithRegex = originalExtractWithRegex; // Restore original method
    });
  });
});