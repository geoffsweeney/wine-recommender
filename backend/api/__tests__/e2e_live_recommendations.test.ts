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
      expect(response.body.primaryRecommendation).toHaveProperty('name');
      expect(response.body.primaryRecommendation).toHaveProperty('type');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      // Check for known good red wine types for steak
      const wineType = response.body.primaryRecommendation.type?.toLowerCase() ?? '';
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() ?? '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineType.includes('red') || 
        wineName.includes('cabernet') || 
        wineName.includes('malbec') || 
        wineName.includes('syrah') ||
        wineName.includes('Shiraz') ||
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
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const wineType = response.body.primaryRecommendation.type?.toLowerCase() || '';
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineType.includes('white') || 
        wineName.includes('pinot grigio') || 
        wineName.includes('sauvignon blanc') || 
        wineName.includes('albariño') ||
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
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('pinot noir') || 
        wineName.includes('chianti') || 
        wineName.includes('beaujolais') ||
        wineName.includes('chardonnay') ||
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
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('champagne') || 
        wineName.includes('prosecco') || 
        wineName.includes('chablis') ||
        wineName.includes('muscadet') ||
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
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('chianti') || 
        wineName.includes('sangiovese') || 
        wineName.includes('barbera') ||
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
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('pinot grigio') || 
        wineName.includes('vermentino') || 
        wineName.includes('soave') ||
        wineName.includes('albariño') ||
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
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('port') || 
        wineName.includes('cabernet') || 
        wineName.includes('bordeaux') ||
        wineName.includes('sherry') ||
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
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('sauvignon blanc') || 
        wineName.includes('sancerre') || 
        wineName.includes('pouilly') ||
        wineName.includes('albariño') ||
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
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('moscato') || 
        wineName.includes('riesling') || 
        wineName.includes('gewürztraminer') ||
        wineName.includes('ice wine') ||
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
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('port') || 
        wineName.includes('madeira') || 
        wineName.includes('sherry') ||
        wineName.includes('banyuls') ||
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
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('riesling') || 
        wineName.includes('gewürztraminer') || 
        wineName.includes('viognier') ||
        wineName.includes('rosé') ||
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
      expect(response.body.confidence).toBeGreaterThan(0.0);
      
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('tempranillo') || 
        wineName.includes('rioja') || 
        wineName.includes('albariño') ||
        wineName.includes('verdejo') ||
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
      expect(response.body).toHaveProperty('explanation');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      // Should still provide some recommendation even for vague requests
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
      expect(response.body).toHaveProperty('explanation');
      // Should provide explanation addressing the conflicting preferences
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
      expect(response.body).toHaveProperty('explanation');
      expect(response.body.confidence).toBeGreaterThan(0.0);
      // Should attempt to make a recommendation even for unusual combinations
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
      expect(response.body).toHaveProperty('explanation');
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
      expect(response.body).toHaveProperty('explanation');
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
      expect(response.body).toHaveProperty('explanation');
      // Should provide an explanation about why this might be challenging
      // and offer the closest reasonable alternative
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
      expect(response.body).toHaveProperty('explanation');
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
      expect(response.body).toHaveProperty('explanation');
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('zinfandel') || 
        wineName.includes('syrah') || 
        wineName.includes('shiraz') ||
        wineName.includes('malbec') ||
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('rosé') || 
        wineName.includes('rosato') || 
        wineName.includes('provence') ||
        wineName.includes('sauvignon blanc') ||
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('shiraz') || 
        wineName.includes('barossa') || 
        wineName.includes('mclaren vale') ||
        wineName.includes('hunter valley') ||
        wineName.includes('cabernet') ||
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('riesling') || 
        wineName.includes('eden valley') || 
        wineName.includes('clare valley') ||
        wineName.includes('sauvignon blanc') ||
        wineName.includes('gewürztraminer') ||
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('chardonnay') || 
        wineName.includes('margaret river') || 
        wineName.includes('adelaide hills') ||
        wineName.includes('yarra valley') ||
        wineName.includes('sauvignon blanc') ||
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('pinot noir') || 
        wineName.includes('yarra valley') || 
        wineName.includes('mornington peninsula') ||
        wineName.includes('adelaide hills') ||
        wineName.includes('tasman') ||
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('grenache') || 
        wineName.includes('gsm') || 
        wineName.includes('rhône') ||
        wineName.includes('barossa') ||
        wineName.includes('shiraz') ||
        wineName.includes('mclaren vale') ||
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('semillon') || 
        wineName.includes('hunter valley') || 
        wineName.includes('sauvignon blanc') ||
        wineName.includes('riesling') ||
        wineName.includes('verdelho') ||
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('cabernet sauvignon') || 
        wineName.includes('coonawarra') || 
        wineName.includes('margaret river') ||
        wineName.includes('cabernet') ||
        wineName.includes('shiraz') ||
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('sparkling') || 
        wineName.includes('prosecco') || 
        wineName.includes('champagne') ||
        wineName.includes('méthode') ||
        wineName.includes('traditional') ||
        wineName.includes('tasmanian') ||
        wineName.includes('yarra valley') ||
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('sauvignon blanc') || 
        wineName.includes('chardonnay') || 
        wineName.includes('riesling') ||
        wineName.includes('pinot grigio') ||
        wineName.includes('adelaide hills') ||
        wineName.includes('yarra valley') ||
        wineName.includes('tasmanian') ||
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
      const wineName = response.body.primaryRecommendation.name?.toLowerCase() || '';
      const explanation = response.body.explanation?.toLowerCase() || '';
      
      expect(
        wineName.includes('port') || 
        wineName.includes('fortified') || 
        wineName.includes('muscat') ||
        wineName.includes('tokay') ||
        wineName.includes('rutherglen') ||
        wineName.includes('stickies') ||
        wineName.includes('dessert') ||
        explanation.includes('australian') ||
        explanation.includes('fortified') ||
        explanation.includes('sweet') ||
        explanation.includes('dessert') ||
        explanation.includes('pavlova')
      ).toBeTruthy();
    });
  });
});