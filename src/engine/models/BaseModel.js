import { toolDefinitions, dispatchTool } from '../tools/index.js';
import { logger } from '../../utils/logger.js';

export default class BaseModel {
  constructor(client, model) {
    this.client = client;
    this.model = model;
    this.messages = [];
  }

  addMessage(role, content, extra = {}) {
    this.messages.push({ role, content, ...extra });
  }

  async run(query) {
    this.addMessage('user', query);

    while (true) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: this.messages,
          tools: toolDefinitions,
          tool_choice: "auto"
        });

        const message = response.choices[0].message;
        
        // Handle the model's response (with potential tool calls)
        await this.handleResponse(message);

        if (message.content) {
          process.stdout.write(message.content);
        }

        if (!message.tool_calls) {
          process.stdout.write("\n\n");
          break;
        }

        // Execute tool calls
        for (const toolCall of message.tool_calls) {
          const name = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          
          logger.secondary(`\n[Tool Call]: ${name}(${JSON.stringify(args)})`);
          const result = await dispatchTool(name, args);
          
          this.addMessage('tool', result, { tool_call_id: toolCall.id });
        }
      } catch (err) {
        if (err.response) {
          logger.error(`\n[API Error] Status: ${err.status}`);
          logger.error(`[API Error] Data: ${JSON.stringify(err.response.data || err.response)}`);
        }
        throw err;
      }
    }
  }

  /**
   * Overridden by subclasses to handle model-specific message formatting/history.
   */
  async handleResponse(message) {
    this.messages.push(message);
  }
}
