class Plugin {
  constructor(name, description, version) {
    this.name = name;
    this.description = description;
    this.version = version;
    this.enabled = true;
  }
  
  enable() {
    this.enabled = true;
    console.log(`✅ Plugin ${this.name} enabled`);
  }
  
  disable() {
    this.enabled = false;
    console.log(`❌ Plugin ${this.name} disabled`);
  }
  
  async initialize(client) {
    throw new Error('initialize() must be implemented');
  }
  
  async cleanup() {
    // Cleanup resources
  }
}

// Example plugin
class AIPlugin extends Plugin {
  constructor() {
    super('ai', 'AI functionality plugin', '1.0.0');
    this.openai = null;
  }
  
  async initialize(client) {
    const { Configuration, OpenAIApi } = require('openai');
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);
    
    // Register AI commands
    this.registerCommands(client);
  }
  
  async generateText(prompt) {
    const response = await this.openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 150
    });
    
    return response.data.choices[0].text.trim();
  }
}

module.exports = { Plugin, AIPlugin };
