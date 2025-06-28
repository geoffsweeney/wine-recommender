import "reflect-metadata";
import { container } from 'tsyringe';
import { setupContainer } from '../di/container';
import { KnowledgeGraphService } from '../services/KnowledgeGraphService';
import { TYPES } from '../di/Types';
import { WineNode } from '../types';
import { logger } from '../utils/logger';
import { Driver } from 'neo4j-driver';

async function addWines() {
  setupContainer(); // Setup dependency injection

  const knowledgeGraphService = container.resolve(KnowledgeGraphService);

  const winesToAdd: WineNode[] = [
    {
      id: 'wine-1',
      name: 'Chateau Lafite Rothschild',
      type: 'Red',
      region: 'Bordeaux, France',
      vintage: 2018,
      price: 1500,
      rating: 98,
    },
    {
      id: 'wine-2',
      name: 'Duckhorn Vineyards Three Palms Vineyard Cabernet Sauvignon',
      type: 'Red',
      region: 'Napa Valley, California',
      vintage: 2019,
      price: 120,
      rating: 95,
    },
  ];

  for (const wine of winesToAdd) {
    try {
      await knowledgeGraphService.createWineNode(wine);
      logger.info(`Successfully added wine: ${wine.name}`);
    } catch (error) {
      logger.error(`Failed to add wine ${wine.name}:`, error);
    }
  }

  // Close Neo4j driver connection
  const driver = container.resolve<Driver>(TYPES.Neo4jDriver);
  if (driver) {
    await driver.close();
    logger.info('Neo4j driver closed.');
  }

  process.exit(0); // Exit cleanly
}

addWines().catch(error => {
  logger.error('Error running add-wines script:', error);
  process.exit(1);
});