import { injectable } from 'tsyringe';
import { Neo4jService } from './Neo4jService';

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

@injectable()
export class MockNeo4jService implements Partial<Neo4jService> {
  async executeQuery(query: string, params?: Record<string, any>): Promise<any[]> {
    if (query.includes('MATCH (w:Wine)')) {
      return mockWines.filter(wine => {
        const matchesQuery = !params?.query || wine.name.toLowerCase().includes(params.query.toLowerCase());
        const matchesRegion = !params?.region || wine.region === params.region;
        const matchesPrice = (!params?.minPrice || wine.price >= params.minPrice) && 
                          (!params?.maxPrice || wine.price <= params.maxPrice);
        return matchesQuery && matchesRegion && matchesPrice;
      });
    }
    return [];
  }

  async verifyConnection(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    // No-op
  }
}