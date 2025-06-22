import { Wine } from '../models/Wine';

export interface IWineRepository {
  getAllWines(): Promise<Wine[]>;
  searchWines(criteria: { name?: string; type?: string }): Promise<Wine[]>;
  getWineById(id: string): Promise<Wine | null>;
}