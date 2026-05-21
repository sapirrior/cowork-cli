import BaseModel from './BaseModel.js';

/**
 * Gemini-specific model handler.
 * Handles preservation of 'thought_signature' in tool calls.
 */
export default class GeminiModel extends BaseModel {
  /**
   * Gemini requires the 'thought_signature' to be passed back in the history.
   * We ensure the message object we store retains these extra fields.
   */
  async handleResponse(message) {
    // If this is a tool call, we look for the thought signature
    // In the OpenAI-compatible API, it's often in message.tool_calls[i].extra_content
    
    // We store the message as-is. When passing it back to the client,
    // if the client is the standard OpenAI SDK, it might strip unknown fields.
    // However, the Gemini API strictly requires them.
    
    this.messages.push(message);
  }
  
  // We might need to override run to handle the 'extra_body' if the SDK is too strict,
  // but let's try the simple history preservation first.
}
