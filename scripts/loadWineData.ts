import "reflect-metadata";
import { Neo4jService } from '../backend/services/Neo4jService';
import { container } from 'tsyringe';

// Set default Neo4j credentials if none provided
if (!process.env.NEO4J_URI) {
  process.env.NEO4J_URI = 'bolt://localhost:7687';
  process.env.NEO4J_USER = 'neo4j';
  process.env.NEO4J_PASSWORD = 'password';
}

interface Wine {
  id: string;
  name: string;
  type: string;
  region: string;
  country: string;
  price: number;
  rating: number;
  description: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

const wineData: Wine[] = [
  {
    id: 'w1',
    name: 'Château Margaux',
    type: 'Red',
    region: 'Bordeaux',
    country: 'France',
    price: 500,
    rating: 98,
    description: 'Elegant and refined with silky tannins'
  },
  // Add more wine data...
];

const userData: User[] = [
  {
    id: 'u1',
    name: 'John Smith',
    email: 'john@example.com'
  },
  // Add more user data...
];

const preferences = [
  { userId: 'u1', wineId: 'w1', rating: 5 }
];

async function loadData() {
  const neo4j = container.resolve(Neo4jService);

  try {
    // Create constraints
    await neo4j.executeQuery(`
      CREATE CONSTRAINT wine_id IF NOT EXISTS
      FOR (w:Wine) REQUIRE w.id IS UNIQUE
    `);

    await neo4j.executeQuery(`
      CREATE CONSTRAINT user_id IF NOT EXISTS
      FOR (u:User) REQUIRE u.id IS UNIQUE
    `);

    // Load wines
    for (const wine of wineData) {
      await neo4j.executeQuery(`
        MERGE (w:Wine {id: $id})
        SET w += $properties
      `, {
        id: wine.id,
        properties: {
          name: wine.name,
          type: wine.type,
          region: wine.region,
          country: wine.country,
          price: wine.price,
          rating: wine.rating,
          description: wine.description
        }
      });
    }

    // Load users
    for (const user of userData) {
      await neo4j.executeQuery(`
        MERGE (u:User {id: $id})
        SET u += $properties
      `, {
        id: user.id,
        properties: {
          name: user.name,
          email: user.email
        }
      });
    }

    // Create preferences
    for (const pref of preferences) {
      await neo4j.executeQuery(`
        MATCH (u:User {id: $userId})
        MATCH (w:Wine {id: $wineId})
        MERGE (u)-[r:PREFERS {rating: $rating}]->(w)
      `, pref);
    }

    console.log('Data loaded successfully');
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    await neo4j.close();
  }
}

loadData();
