import { Agent } from './Agent';

export class InputValidationAgent implements Agent {
  getName(): string {
    return 'InputValidationAgent';
  }

  async handleMessage(message: string): Promise<{ isValid: boolean; processedInput?: { ingredients: string[] }; error?: string }> {
    console.log('InputValidationAgent received message:', message);

    if (typeof message !== 'string' || message.trim() === '') {
      return { isValid: false, error: 'Invalid input: message must be a non-empty string.' };
    }

    // Basic ingredient extraction for POC
    const lowerCaseMessage = message.toLowerCase();
    const ingredientsKeyword = 'with';
    const ingredientsIndex = lowerCaseMessage.indexOf(ingredientsKeyword);

    let ingredients: string[] = [];
    if (ingredientsIndex !== -1) {
      const ingredientsString = message.substring(ingredientsIndex + ingredientsKeyword.length).trim();
      if (ingredientsString) {
        // Simple split by " and " or "," for multiple ingredients
        ingredients = ingredientsString.split(/ and |,/).map(ingredient => ingredient.trim()).filter(ingredient => ingredient.length > 0);
      }
    }

    if (ingredients.length === 0) {
       return { isValid: false, error: 'Could not extract ingredients from the message.' };
    }


    console.log('InputValidationAgent extracted ingredients:', ingredients);
    return { isValid: true, processedInput: { ingredients } };
  }
}

// TODO: Implement actual input validation logic