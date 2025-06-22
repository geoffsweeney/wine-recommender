import { PreferenceExtractionService } from '../PreferenceExtractionService';
import { injectable, inject } from 'tsyringe'; // Import injectable and inject
import { TYPES } from '../../di/Types'; // Import TYPES
import { mockDeep } from 'jest-mock-extended'; // Import mockDeep
import winston from 'winston'; // Import winston

// Define interface for HTTP client (should match the one in PreferenceExtractionService)
interface IHttpClient {
  post<T>(url: string, data?: any, config?: any): Promise<{ data: T; status: number; statusText: string; headers: any; config: any; request?: any }>;
  // Add other methods if needed (get, put, delete, etc.)
}

describe('PreferenceExtractionService', () => {
  let service: PreferenceExtractionService;
  let mockDucklingUrl: string;
  let mockHttpClient: jest.Mocked<IHttpClient>; // Use jest.Mocked<IHttpClient> for better typing
  let mockLogger: winston.Logger; // Use winston.Logger

  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();

    // Create mock dependencies
    mockDucklingUrl = 'http://mock-duckling-api/parse'; // Mock Duckling URL
    mockHttpClient = { // Mock HTTP client
      post: jest.fn(),
    };
    mockLogger = mockDeep<winston.Logger>(); // Use mockDeep for winston.Logger

    // Instantiate service with mock dependencies
    service = new PreferenceExtractionService(mockDucklingUrl, mockHttpClient, mockLogger);
  });

  // Test cases for attemptFastExtraction moved directly into this describe block

  it('should prioritize Duckling results over Regex results for the same preference type', async () => {
    const userInput = 'I want a red wine (Duckling) and a dry wine (Regex).';
   const mockDucklingResponse = {
  status: 200,
  data: [
    // ... entity data ...
  ],
  statusText: 'OK', // Added
  headers: {}, // Added
  config: {}, // Added
  request: {}, // Added
};

    mockHttpClient.post.mockResolvedValue(mockDucklingResponse); // Use mockHttpClient

    const preferences = await service.attemptFastExtraction(userInput);

    expect(preferences).toEqual({ wineType: 'red', sweetness: 'dry' }); // Duckling's 'red' should be prioritized
  });

  it('should merge results from both Regex and Duckling if keys are different', async () => {
    const userInput = 'I want a red wine and a wine around 20 EUR.';
    const mockDucklingResponse = {
  status: 200,
  data: [
    {
      dim: 'number',
      value: {
        value: 20,
        unit: 'EUR'
      }
    }
  ],
  statusText: 'OK', // Added
  headers: {}, // Added
  config: {}, // Added
  request: {}, // Added
};

    mockHttpClient.post.mockResolvedValue(mockDucklingResponse); // Use mockHttpClient

    const preferences = await service.attemptFastExtraction(userInput);

    expect(preferences).toEqual({ wineType: 'red', priceRange: [20, 20] });
  });

  it('should return null if neither Regex nor Duckling find preferences', async () => {
    const userInput = 'I like cheese.';
    const mockDucklingResponse = {
  status: 200,
  data: [
    {
      dim: 'number',
      value: {
        value: 25,
        unit: 'USD'
      }
    },
    {
      dim: 'location',
      value: {
        value: 'Australia'
      }
    }
  ],
  statusText: 'OK', // Added
  headers: {}, // Added
  config: {}, // Added
  request: {}, // Added
};

    // Mock Duckling to return an empty array, simulating no preferences found
    mockHttpClient.post.mockResolvedValue({ data: [], status: 200, statusText: 'OK', headers: {}, config: {} });

    const preferences = await service.attemptFastExtraction(userInput);

    expect(preferences).toBeNull();
  });

  it('should handle multiple Duckling entities and merge with Regex', async () => {
    const userInput = 'I want a dry red wine around 25 USD from Australia.';
    const mockDucklingResponse = {
  status: 200,
  data: [
    {
      "dim": "number",
      "value": { "value": 25, "unit": "USD" },
      "text": "25 USD",
      "start": 30,
      "end": 36
    },
    {
      "dim": "location",
      "value": { "value": "Australia" },
      "text": "Australia",
      "start": 42,
      "end": 51
    }
  ],
  statusText: 'OK', // Added
  headers: {}, // Added
  config: {}, // Added
  request: {}, // Added
};

    mockHttpClient.post.mockResolvedValue(mockDucklingResponse); // Use mockHttpClient

    const preferences = await service.attemptFastExtraction(userInput);

    expect(preferences).toEqual({
      wineType: 'red',
      sweetness: 'dry',
      priceRange: [25, 25],
      location: 'Australia',
    });
  });

  it('should handle overlapping preferences from Duckling and Regex, prioritizing Duckling', async () => {
    const userInput = 'I want a sweet white wine from France around 30 EUR.';
    const mockDucklingResponse = {
      status: 200,
      data: [
        {
          dim: 'location',
          value: { value: 'France' },
          text: 'France',
          start: 30,
          end: 36
        },
        {
          dim: 'interval',
          value: {
            type: 'interval',
            from: { value: 30, unit: 'EUR' },
            to: { value: 30, unit: 'EUR' }
          },
          text: '30 EUR',
          start: 43,
          end: 49
        }
      ],
      statusText: 'OK',
      headers: {},
      config: {},
      request: {},
    };

    mockHttpClient.post.mockResolvedValue(mockDucklingResponse);

    const preferences = await service.attemptFastExtraction(userInput);

    expect(preferences).toEqual({
      wineType: 'white',
      sweetness: 'sweet',
      priceRange: [30, 30],
      location: 'France',
    });
  });

  describe('Error Handling', () => {
    it('should handle Duckling API failure gracefully', async () => {
      const userInput = 'I want a red wine';
      mockHttpClient.post.mockRejectedValue(new Error('API timeout'));

      const preferences = await service.attemptFastExtraction(userInput);

      expect(preferences).toEqual({ wineType: 'red' }); // Should still get regex results
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during Duckling extraction:',
        expect.any(Error)
      );
    });

    it('should handle empty input', async () => {
      const preferences = await service.attemptFastExtraction('');
      expect(preferences).toBeNull();
    });
  });

  describe('Direct Method Tests', () => {
    it('extractWithRegex should handle all wine types', () => {
      const inputs = [
        { input: 'I want red wine', expected: { wineType: 'red' } },
        { input: 'white please', expected: { wineType: 'white' } },
        { input: 'something sparkling', expected: { wineType: 'sparkling' } },
        { input: 'maybe a rose', expected: { wineType: 'rose' } }
      ];

      inputs.forEach(({input, expected}) => {
        expect(service['extractWithRegex'](input)).toEqual(expected);
      });
    });

    it('extractWithDuckling should handle price ranges', async () => {
      const mockResponse = {
        status: 200,
        data: [{
          dim: 'interval',
          value: {
            type: 'interval',
            from: { value: 20, unit: 'EUR' },
            to: { value: 50, unit: 'EUR' }
          }
        }],
        statusText: 'OK',
        headers: {},
        config: {},
        request: {},
      };
      mockHttpClient.post.mockResolvedValue(mockResponse);

      const result = await service['extractWithDuckling']('wine 20-50 EUR');
      expect(result).toEqual({ priceRange: [20, 50] });
    });
  });
});
