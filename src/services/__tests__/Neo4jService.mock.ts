import { jest } from '@jest/globals';
import { Neo4jService } from '../Neo4jService';

// Create a mock class that implements the Neo4jService interface
// This allows us to use it in dependency injection while controlling method behavior
import { jest } from '@jest/globals';
import { Neo4jService } from '../Neo4jService';

// Create a mock class that implements the Neo4jService interface
// This allows us to use it in dependency injection while controlling method behavior
export class MockNeo4jService implements Neo4jService {
  // Mock public methods with explicit types
  executeQuery = jest.fn<Neo4jService['executeQuery']>();
  verifyConnection = jest.fn<Neo4jService['verifyConnection']>();
  close = jest.fn<Neo4jService['close']>();
  convertToNeo4jTypes = jest.fn<Neo4jService['convertToNeo4jTypes']>(value => value); // Basic passthrough mock

  // Private members are not typically mocked in this way for dependency injection
  // If private members were essential for the mock's function, a different mocking approach might be needed.
  // private driver: any;
  // private circuit: any;

  constructor() {
    // Constructor can be empty or set up initial mock behavior
  }
}