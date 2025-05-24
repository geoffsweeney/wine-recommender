import { ConversationHistoryService, ConversationTurn } from '../ConversationHistoryService';

describe('ConversationHistoryService', () => {
  let service: ConversationHistoryService;

  beforeEach(() => {
    service = new ConversationHistoryService();
  });

  it('should add a conversation turn to history', () => {
    const userId = 'user1';
    const turn: ConversationTurn = { role: 'user', content: 'Hello' };
    service.addConversationTurn(userId, turn);
    const history = service.getConversationHistory(userId);
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(turn);
  });

  it('should retrieve conversation history for a user', () => {
    const userId = 'user2';
    const turn1: ConversationTurn = { role: 'user', content: 'Hi' };
    const turn2: ConversationTurn = { role: 'assistant', content: 'How can I help?' };
    service.addConversationTurn(userId, turn1);
    service.addConversationTurn(userId, turn2);
    const history = service.getConversationHistory(userId);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(turn1);
    expect(history[1]).toEqual(turn2);
  });

  it('should return an empty array for a user with no history', () => {
    const userId = 'user3';
    const history = service.getConversationHistory(userId);
    expect(history).toHaveLength(0);
  });

  it('should clear conversation history for a user', () => {
    const userId = 'user4';
    const turn1: ConversationTurn = { role: 'user', content: 'Test' };
    service.addConversationTurn(userId, turn1);
    let history = service.getConversationHistory(userId);
    expect(history).toHaveLength(1);
    service.clearConversationHistory(userId);
    history = service.getConversationHistory(userId);
    expect(history).toHaveLength(0);
  });

  it('should handle multiple users with separate histories', () => {
    const userId1 = 'user5';
    const userId2 = 'user6';
    const turn1: ConversationTurn = { role: 'user', content: 'User 5 message' };
    const turn2: ConversationTurn = { role: 'user', content: 'User 6 message' };

    service.addConversationTurn(userId1, turn1);
    service.addConversationTurn(userId2, turn2);

    const history1 = service.getConversationHistory(userId1);
    const history2 = service.getConversationHistory(userId2);

    expect(history1).toHaveLength(1);
    expect(history1[0]).toEqual(turn1);
    expect(history2).toHaveLength(1);
    expect(history2[0]).toEqual(turn2);
  });
});