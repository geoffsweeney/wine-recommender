import { injectable } from 'tsyringe';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

@injectable()
export class ConversationHistoryService {
  private history: Map<string, ConversationTurn[]> = new Map();

  /**
   * Adds a new turn to a user's conversation history.
   * @param userId The ID of the user.
   * @param turn The conversation turn to add.
   */
  addConversationTurn(userId: string, turn: ConversationTurn): void {
    if (!this.history.has(userId)) {
      this.history.set(userId, []);
    }
    this.history.get(userId)!.push(turn);
  }

  /**
   * Retrieves a user's conversation history.
   * @param userId The ID of the user.
   * @returns An array of conversation turns, or an empty array if no history exists.
   */
  getConversationHistory(userId: string): ConversationTurn[] {
    return this.history.get(userId) || [];
  }

  /**
   * Clears a user's conversation history.
   * @param userId The ID of the user.
   */
  clearConversationHistory(userId: string): void {
    this.history.delete(userId);
  }
}