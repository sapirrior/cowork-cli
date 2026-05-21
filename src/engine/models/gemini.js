import BaseModel from './BaseModel.js';

/**
 * Gemini-specific model handler.
 * Handles preservation of 'thought_signature' in tool calls.
 */
export default class GeminiModel extends BaseModel {
  /**
   * Gemini requires the 'thought_signature' and potentially other metadata
   * to be passed back in the conversation history for tool-calling turns.
   */
  async handleResponse(message) {
    // We push the full message object to ensure all provider-specific
    // fields (like thought_signature) are preserved in the history.
    this.messages.push(message);
  }
  
  // We might need to override run to handle the 'extra_body' if the SDK is too strict,
  // but let's try the simple history preservation first.
}
