import request from 'supertest';

const BASE_URL = 'http://localhost:3001/api'; // Base URL for the running application

// Increase Jest timeout for these E2E tests as LLM calls can be slow
jest.setTimeout(60000); // 60 seconds

describe('End-to-End Live Recommendation API', () => {
  // Note: These tests require the application to be running on http://localhost:3001
  // before executing the test suite.

  describe('POST /recommendations - Classic Food & Wine Pairings', () => {
    it('should recommend Cabernet Sauvignon or Malbec for grilled steak', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-steak',
          input: { message: 'I am having a juicy grilled ribeye steak tonight. What wine should I drink?', ingredients: [], recommendationSource: 'knowledgeGraph' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) =>
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) =>
        typeof alt === 'object' &&
        alt.hasOwnProperty('name') &&
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      // Check for known good red wine types for steak
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('cabernet') ||
        primaryRecommendationName.includes('malbec') ||
        primaryRecommendationName.includes('syrah') ||
        primaryRecommendationName.includes('shiraz') ||
        primaryRecommendationGrapeVarieties.includes('cabernet sauvignon') ||
        primaryRecommendationGrapeVarieties.includes('malbec') ||
        primaryRecommendationGrapeVarieties.includes('syrah') ||
        primaryRecommendationGrapeVarieties.includes('shiraz') ||
        explanation.includes('red wine') ||
        explanation.includes('cabernet') ||
        explanation.includes('malbec')
      ).toBeTruthy();
    });

    it('should recommend Pinot Grigio or Sauvignon Blanc for grilled fish', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-fish',
          input: { message: 'I am making grilled halibut with lemon herbs. What wine pairs well?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('explanation');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('pinot grigio') ||
        primaryRecommendationName.includes('sauvignon blanc') ||
        primaryRecommendationName.includes('albariño') ||
        primaryRecommendationGrapeVarieties.includes('pinot grigio') ||
        primaryRecommendationGrapeVarieties.includes('sauvignon blanc') ||
        primaryRecommendationGrapeVarieties.includes('albariño') ||
        explanation.includes('white wine') ||
        explanation.includes('crisp') ||
        explanation.includes('citrus')
      ).toBeTruthy();
    });

    it('should recommend Pinot Noir or light red for roasted chicken', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-chicken',
          input: { message: 'What wine goes well with herb-roasted chicken with rosemary?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('explanation');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('pinot noir') ||
        primaryRecommendationName.includes('chianti') ||
        primaryRecommendationName.includes('beaujolais') ||
        primaryRecommendationName.includes('chardonnay') ||
        primaryRecommendationGrapeVarieties.includes('pinot noir') ||
        primaryRecommendationGrapeVarieties.includes('sangiovese') ||
        primaryRecommendationGrapeVarieties.includes('gamay') ||
        primaryRecommendationGrapeVarieties.includes('chardonnay') ||
        explanation.includes('pinot noir') ||
        explanation.includes('light red') ||
        explanation.includes('medium-bodied')
      ).toBeTruthy();
    });

    it('should recommend Champagne or Prosecco for oysters', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-oysters',
          input: { message: 'I have fresh Kumamoto oysters. What wine should I serve?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('explanation');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('champagne') ||
        primaryRecommendationName.includes('prosecco') ||
        primaryRecommendationName.includes('chablis') ||
        primaryRecommendationName.includes('muscadet') ||
        primaryRecommendationGrapeVarieties.includes('chardonnay') ||
        primaryRecommendationGrapeVarieties.includes('pinot noir') ||
        primaryRecommendationGrapeVarieties.includes('pinot meunier') ||
        primaryRecommendationGrapeVarieties.includes('glera') ||
        primaryRecommendationGrapeVarieties.includes('melon de bourgogne') ||
        explanation.includes('sparkling') ||
        explanation.includes('bubbles') ||
        explanation.includes('crisp') ||
        explanation.includes('mineral')
      ).toBeTruthy();
    });
  });

  describe('POST /recommendations - Pasta & Italian Food Pairings', () => {
    it('should recommend Chianti or Sangiovese for tomato-based pasta', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-pasta-tomato',
          input: { message: 'I am making spaghetti with marinara sauce and meatballs. Wine recommendation?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('chianti') ||
        primaryRecommendationName.includes('sangiovese') ||
        primaryRecommendationName.includes('barbera') ||
        primaryRecommendationGrapeVarieties.includes('sangiovese') ||
        primaryRecommendationGrapeVarieties.includes('barbera') ||
        explanation.includes('italian') ||
        explanation.includes('acidity') ||
        explanation.includes('tomato')
      ).toBeTruthy();
    });

    it('should recommend Pinot Grigio or Vermentino for seafood pasta', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-pasta-seafood',
          input: { message: 'Making linguine alle vongole (clam pasta) with white wine sauce. What wine pairs?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('pinot grigio') ||
        primaryRecommendationName.includes('vermentino') ||
        primaryRecommendationName.includes('soave') ||
        primaryRecommendationName.includes('albariño') ||
        primaryRecommendationGrapeVarieties.includes('pinot grigio') ||
        primaryRecommendationGrapeVarieties.includes('vermentino') ||
        primaryRecommendationGrapeVarieties.includes('garganega') ||
        primaryRecommendationGrapeVarieties.includes('albariño') ||
        explanation.includes('white') ||
        explanation.includes('seafood') ||
        explanation.includes('italian')
      ).toBeTruthy();
    });
  });

  describe('POST /recommendations - Cheese & Charcuterie Pairings', () => {
    it('should recommend Port or Cabernet for aged cheddar', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-aged-cheddar',
          input: { message: 'I have a 5-year aged Vermont cheddar. What wine complements it?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('port') ||
        primaryRecommendationName.includes('cabernet') ||
        primaryRecommendationName.includes('bordeaux') ||
        primaryRecommendationName.includes('sherry') ||
        primaryRecommendationGrapeVarieties.includes('touriga nacional') ||
        primaryRecommendationGrapeVarieties.includes('cabernet sauvignon') ||
        primaryRecommendationGrapeVarieties.includes('merlot') ||
        primaryRecommendationGrapeVarieties.includes('tinta roriz') ||
        explanation.includes('bold') ||
        explanation.includes('aged') ||
        explanation.includes('robust')
      ).toBeTruthy();
    });

    it('should recommend Sauvignon Blanc or Loire Valley for goat cheese', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-goat-cheese',
          input: { message: 'Serving fresh goat cheese with herbs. Wine pairing suggestion?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('sauvignon blanc') ||
        primaryRecommendationName.includes('sancerre') ||
        primaryRecommendationName.includes('pouilly') ||
        primaryRecommendationName.includes('albariño') ||
        primaryRecommendationGrapeVarieties.includes('sauvignon blanc') ||
        primaryRecommendationGrapeVarieties.includes('albariño') ||
        explanation.includes('crisp') ||
        explanation.includes('acidity') ||
        explanation.includes('citrus')
      ).toBeTruthy();
    });
  });

  describe('POST /recommendations - Dessert Pairings', () => {
    it('should recommend Moscato or Riesling for fruit desserts', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-fruit-dessert',
          input: { message: 'I made a fresh peach tart with vanilla cream. Wine recommendation?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('moscato') ||
        primaryRecommendationName.includes('riesling') ||
        primaryRecommendationName.includes('gewürztraminer') ||
        primaryRecommendationName.includes('ice wine') ||
        primaryRecommendationGrapeVarieties.includes('moscato bianco') ||
        primaryRecommendationGrapeVarieties.includes('riesling') ||
        primaryRecommendationGrapeVarieties.includes('gewürztraminer') ||
        explanation.includes('sweet') ||
        explanation.includes('dessert') ||
        explanation.includes('fruit')
      ).toBeTruthy();
    });

    it('should recommend Port or Madeira for chocolate desserts', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-chocolate',
          input: { message: 'Serving dark chocolate truffles and espresso. What wine pairs well?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('port') ||
        primaryRecommendationName.includes('madeira') ||
        primaryRecommendationName.includes('sherry') ||
        primaryRecommendationName.includes('banyuls') ||
        primaryRecommendationGrapeVarieties.includes('touriga nacional') ||
        primaryRecommendationGrapeVarieties.includes('tinta negra mole') ||
        primaryRecommendationGrapeVarieties.includes('palomino') ||
        primaryRecommendationGrapeVarieties.includes('grenache') ||
        explanation.includes('fortified') ||
        explanation.includes('chocolate') ||
        explanation.includes('rich')
      ).toBeTruthy();
    });
  });

  describe('POST /recommendations - Spicy & Ethnic Cuisine Pairings', () => {
    it('should recommend Riesling or Gewürztraminer for spicy Thai food', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-thai-spicy',
          input: { message: 'Making spicy Thai green curry with chicken. What wine can handle the heat?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('riesling') ||
        primaryRecommendationName.includes('gewürztraminer') ||
        primaryRecommendationName.includes('viognier') ||
        primaryRecommendationName.includes('rosé') ||
        primaryRecommendationGrapeVarieties.includes('riesling') ||
        primaryRecommendationGrapeVarieties.includes('gewürztraminer') ||
        primaryRecommendationGrapeVarieties.includes('viognier') ||
        explanation.includes('off-dry') ||
        explanation.includes('spicy') ||
        explanation.includes('aromatic') ||
        explanation.includes('cooling')
      ).toBeTruthy();
    });

    it('should recommend Tempranillo or Rioja for Spanish paella', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-paella',
          input: { message: 'Cooking seafood paella with saffron. Spanish wine recommendation?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('tempranillo') ||
        primaryRecommendationName.includes('rioja') ||
        primaryRecommendationName.includes('albariño') ||
        primaryRecommendationName.includes('verdejo') ||
        primaryRecommendationGrapeVarieties.includes('tempranillo') ||
        primaryRecommendationGrapeVarieties.includes('garnacha') ||
        primaryRecommendationGrapeVarieties.includes('graciano') ||
        primaryRecommendationGrapeVarieties.includes('albariño') ||
        primaryRecommendationGrapeVarieties.includes('verdejo') ||
        explanation.includes('spanish') ||
        explanation.includes('saffron') ||
        explanation.includes('seafood')
      ).toBeTruthy();
    });
  });

  describe('POST /recommendations - Validation and Error Cases', () => {
    it('should return 400 for missing userId', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({ input: { message: 'Any wine?' } }); // Missing userId

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['userId'],
            message: 'Required',
          }),
        ]),
      );
    });

    it('should return 400 for missing input object', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({ userId: 'user-live-missing-input' }); // Missing input object

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['input'],
            message: 'Required',
          }),
        ]),
      );
    });

    it('should return 400 for empty message', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({ 
          userId: 'user-live-empty-message',
          input: { message: '' }
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for null or undefined message', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({ 
          userId: 'user-live-null-message',
          input: { message: null }
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /recommendations - Edge Cases and Challenging Requests', () => {
    it('should handle vague requests gracefully', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-vague',
          input: { message: 'Wine please' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      // Should still provide some recommendation even for vague requests
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      // No specific assertions for vague requests, just ensure it's not empty
      expect(primaryRecommendationName.length).toBeGreaterThan(0);
    });

    it('should handle conflicting preferences intelligently', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-conflicting',
          input: { message: 'I want a dry sweet wine that goes with both fish and steak' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      // Should provide explanation addressing the conflicting preferences
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      expect(response.body.explanation.length).toBeGreaterThan(50);
    });

    it('should provide response for unusual food combinations', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-unusual',
          input: { message: 'I am eating sushi pizza with pineapple. Wine suggestion?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      // Should attempt to make a recommendation even for unusual combinations
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
    });

    it('should handle budget constraints appropriately', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-budget',
          input: { message: 'I need a wine for beef wellington but my budget is only $15' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation.toLowerCase();
      expect(
        explanation.includes('budget') ||
        explanation.includes('affordable') ||
        explanation.includes('value') ||
        explanation.includes('$')
      ).toBeTruthy();
    });

    it('should handle dietary restrictions and preferences', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-dietary',
          input: { message: 'I am vegan and having stuffed portobello mushrooms. Need organic, sulfite-free wine.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation.toLowerCase();
      expect(
        explanation.includes('vegan') ||
        explanation.includes('organic') ||
        explanation.includes('sulfite') ||
        explanation.includes('mushroom') ||
        explanation.includes('earthy')
      ).toBeTruthy();
    });

    it('should respond appropriately to impossible wine requests', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-impossible',
          input: { message: 'I need a wine that tastes exactly like Coca-Cola but is still wine' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      // Should provide an explanation about why this might be challenging
      // and offer the closest reasonable alternative
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      expect(response.body.explanation.length).toBeGreaterThan(30);
    });

    it('should handle occasion-based requests', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-occasion',
          input: { message: 'Anniversary dinner with lobster thermidor. Want something special and romantic.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation.toLowerCase();
      expect(
        explanation.includes('special') ||
        explanation.includes('elegant') ||
        explanation.includes('anniversary') ||
        explanation.includes('celebration') ||
        explanation.includes('romantic') ||
        explanation.includes('lobster')
      ).toBeTruthy();
    });

    it('should handle regional cuisine expertise requests', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-regional',
          input: { message: 'Making authentic Moroccan tagine with lamb and apricots. Need traditional pairing.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() ?? '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const explanation = response.body.explanation.toLowerCase();
      expect(
        explanation.includes('moroccan') ||
        explanation.includes('tagine') ||
        explanation.includes('lamb') ||
        explanation.includes('apricot') ||
        explanation.includes('spice') ||
        explanation.includes('fruit')
      ).toBeTruthy();
    });
  });

  describe('POST /recommendations - Wine Style and Varietal Specific Tests', () => {
    it('should recommend appropriate wine for barbecue ribs', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-bbq-ribs',
          input: { message: 'Having BBQ pork ribs with smoky sauce. What wine can stand up to this?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() || '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('zinfandel') ||
        primaryRecommendationName.includes('syrah') ||
        primaryRecommendationName.includes('shiraz') ||
        primaryRecommendationName.includes('malbec') ||
        primaryRecommendationGrapeVarieties.includes('zinfandel') ||
        primaryRecommendationGrapeVarieties.includes('syrah') ||
        primaryRecommendationGrapeVarieties.includes('malbec') ||
        explanation.includes('bold') ||
        explanation.includes('smoky') ||
        explanation.includes('barbecue')
      ).toBeTruthy();
    });

    it('should recommend rosé for summer salads', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-summer-salad',
          input: { message: 'Making a fresh summer salad with strawberries and feta. Light wine suggestion?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() || '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('rosé') ||
        primaryRecommendationName.includes('rosato') ||
        primaryRecommendationName.includes('provence') ||
        primaryRecommendationName.includes('sauvignon blanc') ||
        primaryRecommendationGrapeVarieties.includes('grenache') ||
        primaryRecommendationGrapeVarieties.includes('cinsault') ||
        primaryRecommendationGrapeVarieties.includes('mourvèdre') ||
        primaryRecommendationGrapeVarieties.includes('sauvignon blanc') ||
        explanation.includes('light') ||
        explanation.includes('fresh') ||
        explanation.includes('summer')
      ).toBeTruthy();
    });
  });

  describe('POST /recommendations - Australian Wine Pairings', () => {
    it('should recommend Australian Shiraz for kangaroo or game meat', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-aussie-game',
          input: { message: 'Cooking venison steaks with native Australian herbs. What Australian wine pairs well?' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() || '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('shiraz') ||
        primaryRecommendationName.includes('barossa') ||
        primaryRecommendationName.includes('mclaren vale') ||
        primaryRecommendationName.includes('hunter valley') ||
        primaryRecommendationName.includes('cabernet') ||
        primaryRecommendationGrapeVarieties.includes('shiraz') ||
        primaryRecommendationGrapeVarieties.includes('cabernet sauvignon') ||
        explanation.includes('australian') ||
        explanation.includes('shiraz') ||
        explanation.includes('bold') ||
        explanation.includes('spicy')
      ).toBeTruthy();
    });

    it('should recommend Australian Riesling for Asian fusion cuisine', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-aussie-asian',
          input: { message: 'Making Vietnamese-style fish with lemongrass and chili. Prefer Australian wine.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() || '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('riesling') ||
        primaryRecommendationName.includes('eden valley') ||
        primaryRecommendationName.includes('clare valley') ||
        primaryRecommendationName.includes('sauvignon blanc') ||
        primaryRecommendationName.includes('gewürztraminer') ||
        primaryRecommendationGrapeVarieties.includes('riesling') ||
        primaryRecommendationGrapeVarieties.includes('sauvignon blanc') ||
        primaryRecommendationGrapeVarieties.includes('gewürztraminer') ||
        explanation.includes('australian') ||
        explanation.includes('riesling') ||
        explanation.includes('spicy') ||
        explanation.includes('aromatic')
      ).toBeTruthy();
    });

    it('should recommend Australian Chardonnay for seafood', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-aussie-seafood',
          input: { message: 'Grilling barramundi with native pepper berry. Want an Australian white wine.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() || '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('chardonnay') ||
        primaryRecommendationName.includes('margaret river') ||
        primaryRecommendationName.includes('adelaide hills') ||
        primaryRecommendationName.includes('yarra valley') ||
        primaryRecommendationName.includes('sauvignon blanc') ||
        primaryRecommendationGrapeVarieties.includes('chardonnay') ||
        primaryRecommendationGrapeVarieties.includes('sauvignon blanc') ||
        explanation.includes('australian') ||
        explanation.includes('chardonnay') ||
        explanation.includes('crisp') ||
        explanation.includes('citrus')
      ).toBeTruthy();
    });

    it('should recommend Australian Pinot Noir for duck or poultry', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-aussie-duck',
          input: { message: 'Roasting duck with wattleseed crust. Looking for Australian red wine pairing.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() || '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('pinot noir') ||
        primaryRecommendationName.includes('yarra valley') ||
        primaryRecommendationName.includes('mornington peninsula') ||
        primaryRecommendationName.includes('adelaide hills') ||
        primaryRecommendationName.includes('tasman') ||
        primaryRecommendationGrapeVarieties.includes('pinot noir') ||
        explanation.includes('australian') ||
        explanation.includes('pinot noir') ||
        explanation.includes('elegant') ||
        explanation.includes('duck')
      ).toBeTruthy();
    });

    it('should recommend Australian Grenache for Mediterranean-style dishes', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-aussie-med',
          input: { message: 'Making lamb souvlaki with Australian native herbs. Want a local wine match.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() || '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('grenache') ||
        primaryRecommendationName.includes('gsm') ||
        primaryRecommendationName.includes('rhône') ||
        primaryRecommendationName.includes('barossa') ||
        primaryRecommendationName.includes('shiraz') ||
        primaryRecommendationName.includes('mclaren vale') ||
        primaryRecommendationGrapeVarieties.includes('grenache') ||
        primaryRecommendationGrapeVarieties.includes('shiraz') ||
        primaryRecommendationGrapeVarieties.includes('mourvèdre') ||
        explanation.includes('australian') ||
        explanation.includes('grenache') ||
        explanation.includes('lamb') ||
        explanation.includes('herbs')
      ).toBeTruthy();
    });

    it('should recommend Australian Semillon for lighter dishes', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-aussie-light',
          input: { message: 'Having fresh oysters from Coffin Bay. Want an Australian white wine.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() || '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('semillon') ||
        primaryRecommendationName.includes('hunter valley') ||
        primaryRecommendationName.includes('sauvignon blanc') ||
        primaryRecommendationName.includes('riesling') ||
        primaryRecommendationName.includes('verdelho') ||
        primaryRecommendationGrapeVarieties.includes('semillon') ||
        primaryRecommendationGrapeVarieties.includes('sauvignon blanc') ||
        primaryRecommendationGrapeVarieties.includes('riesling') ||
        primaryRecommendationGrapeVarieties.includes('verdelho') ||
        explanation.includes('australian') ||
        explanation.includes('semillon') ||
        explanation.includes('oyster') ||
        explanation.includes('mineral') ||
        explanation.includes('crisp')
      ).toBeTruthy();
    });

    it('should recommend Australian Cabernet Sauvignon for red meat', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-aussie-beef',
          input: { message: 'Grilling wagyu beef with bush tomato relish. Need Australian red wine suggestion.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() || '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('cabernet sauvignon') ||
        primaryRecommendationName.includes('coonawarra') ||
        primaryRecommendationName.includes('margaret river') ||
        primaryRecommendationName.includes('cabernet') ||
        primaryRecommendationName.includes('shiraz') ||
        primaryRecommendationGrapeVarieties.includes('cabernet sauvignon') ||
        primaryRecommendationGrapeVarieties.includes('shiraz') ||
        explanation.includes('australian') ||
        explanation.includes('cabernet') ||
        explanation.includes('bold') ||
        explanation.includes('beef') ||
        explanation.includes('wagyu')
      ).toBeTruthy();
    });

    it('should recommend Australian sparkling wine for celebrations', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-aussie-sparkling',
          input: { message: 'Celebrating with prawns and native finger lime. Want Australian sparkling wine.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() || '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('sparkling') ||
        primaryRecommendationName.includes('prosecco') ||
        primaryRecommendationName.includes('champagne') ||
        primaryRecommendationName.includes('méthode') ||
        primaryRecommendationName.includes('traditional') ||
        primaryRecommendationName.includes('tasmanian') ||
        primaryRecommendationName.includes('yarra valley') ||
        primaryRecommendationGrapeVarieties.includes('chardonnay') ||
        primaryRecommendationGrapeVarieties.includes('pinot noir') ||
        primaryRecommendationGrapeVarieties.includes('pinot meunier') ||
        explanation.includes('australian') ||
        explanation.includes('sparkling') ||
        explanation.includes('celebration') ||
        explanation.includes('prawns') ||
        explanation.includes('citrus')
      ).toBeTruthy();
    });

    it('should recommend cool-climate Australian wines for delicate dishes', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-aussie-delicate',
          input: { message: 'Making pan-fried flathead with lemon myrtle. Want cool-climate Australian wine.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendationName = response.body.primaryRecommendation?.name?.toLowerCase() || '';
      const primaryRecommendationGrapeVarieties = response.body.primaryRecommendation?.grapeVarieties?.map((gv: any) => gv.name.toLowerCase()) ?? [];
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendationName.includes('sauvignon blanc') ||
        primaryRecommendationName.includes('chardonnay') ||
        primaryRecommendationName.includes('riesling') ||
        primaryRecommendationName.includes('pinot grigio') ||
        primaryRecommendationName.includes('adelaide hills') ||
        primaryRecommendationName.includes('yarra valley') ||
        primaryRecommendationName.includes('tasmanian') ||
        primaryRecommendationGrapeVarieties.includes('sauvignon blanc') ||
        primaryRecommendationGrapeVarieties.includes('chardonnay') ||
        primaryRecommendationGrapeVarieties.includes('riesling') ||
        primaryRecommendationGrapeVarieties.includes('pinot grigio') ||
        explanation.includes('australian') ||
        explanation.includes('cool climate') ||
        explanation.includes('delicate') ||
        explanation.includes('lemon') ||
        explanation.includes('citrus')
      ).toBeTruthy();
    });

    it('should recommend fortified Australian wines for rich desserts', async () => {
      const response = await request(BASE_URL)
        .post('/recommendations')
        .send({
          userId: 'user-live-aussie-dessert',
          input: { message: 'Serving pavlova with native Davidson plum. Want Australian dessert wine.' },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('primaryRecommendation');
      expect(response.body).toHaveProperty('alternatives');
      expect(response.body).toHaveProperty('explanation');
      expect(response.body).toHaveProperty('confidence');
      expect(typeof response.body.primaryRecommendation).toBe('object');
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(typeof response.body.primaryRecommendation.name).toBe('string');
      expect(response.body.primaryRecommendation).toHaveProperty('grapeVarieties');
      expect(Array.isArray(response.body.primaryRecommendation.grapeVarieties)).toBe(true);
      expect(response.body.primaryRecommendation.grapeVarieties.every((gv: any) => 
        typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined)
      )).toBe(true);

      expect(Array.isArray(response.body.alternatives)).toBe(true);
      expect(response.body.alternatives.every((alt: any) => 
        typeof alt === 'object' && 
        alt.hasOwnProperty('name') && 
        typeof alt.name === 'string' &&
        alt.hasOwnProperty('grapeVarieties') &&
        Array.isArray(alt.grapeVarieties) &&
        alt.grapeVarieties.every((gv: any) => typeof gv.name === 'string' && (typeof gv.percentage === 'number' || gv.percentage === undefined))
      )).toBe(true);
      expect(response.body).toHaveProperty('conversationId');
      expect(typeof response.body.conversationId).toBe('string');
      expect(response.body).toHaveProperty('canRefine');
      expect(typeof response.body.canRefine).toBe('boolean');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      const primaryRecommendation = response.body.primaryRecommendation?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        primaryRecommendation.includes('port') ||
        primaryRecommendation.includes('fortified') ||
        primaryRecommendation.includes('muscat') ||
        primaryRecommendation.includes('tokay') ||
        primaryRecommendation.includes('rutherglen') ||
        primaryRecommendation.includes('stickies') ||
        primaryRecommendation.includes('dessert') ||
        explanation.includes('australian') ||
        explanation.includes('fortified') ||
        explanation.includes('sweet') ||
        explanation.includes('dessert') ||
        explanation.includes('pavlova')
      ).toBeTruthy();
    });
  });
});