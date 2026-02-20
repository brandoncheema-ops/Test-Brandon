/**
 * Agent Template - Main Entry Point
 *
 * Replace this with your agent's implementation.
 */

const fs = require('fs');
const path = require('path');

class MyAgent {
  constructor() {
    this.config = this.loadConfig();
    this.knowledge = this.loadKnowledge();
  }

  loadConfig() {
    const configPath = path.join(__dirname, '..', 'config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  loadKnowledge() {
    const knowledgeDir = path.join(__dirname, '..', 'knowledge');
    const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md') && f !== 'README.md');
    const knowledge = {};

    for (const file of files) {
      const name = path.basename(file, '.md');
      knowledge[name] = fs.readFileSync(path.join(knowledgeDir, file), 'utf-8');
    }

    return knowledge;
  }

  getInfo() {
    return {
      name: this.config.displayName,
      version: this.config.version,
      status: this.config.status,
      capabilities: this.config.capabilities,
    };
  }
}

module.exports = MyAgent;

if (require.main === module) {
  const agent = new MyAgent();
  console.log('Agent initialized:', JSON.stringify(agent.getInfo(), null, 2));
}
