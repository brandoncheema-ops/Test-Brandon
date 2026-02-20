/**
 * Brandon's Agent - Main Entry Point
 *
 * Primary automation agent for NF6 Family Office operations.
 * Handles property management, booking workflows, financial calculations,
 * and operational tasks.
 */

const fs = require('fs');
const path = require('path');

class BrandonsAgent {
  constructor() {
    this.config = this.loadConfig();
    this.knowledge = this.loadKnowledge();
  }

  /**
   * Load agent configuration from config.json
   */
  loadConfig() {
    const configPath = path.join(__dirname, '..', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  }

  /**
   * Load all knowledge files from the knowledge/ directory
   */
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

  /**
   * Get agent info
   */
  getInfo() {
    return {
      name: this.config.displayName,
      version: this.config.version,
      status: this.config.status,
      capabilities: this.config.capabilities,
      knowledgeFiles: Object.keys(this.knowledge),
    };
  }

  /**
   * Calculate net income for a booking
   */
  calculateNetIncome({ nights, rate, platformFeePercent = 0.20, cleaningFee = 250 }) {
    const gross = nights * rate;
    const platformFee = gross * platformFeePercent;
    const net = gross - platformFee - cleaningFee;

    return {
      gross,
      platformFee,
      cleaningFee,
      net,
    };
  }

  /**
   * Get loaded knowledge context for LLM consumption
   */
  getKnowledgeContext() {
    return Object.entries(this.knowledge)
      .map(([name, content]) => `--- ${name} ---\n${content}`)
      .join('\n\n');
  }
}

// Export for use as a module
module.exports = BrandonsAgent;

// Run standalone
if (require.main === module) {
  const agent = new BrandonsAgent();
  console.log('Agent initialized:', JSON.stringify(agent.getInfo(), null, 2));
}
