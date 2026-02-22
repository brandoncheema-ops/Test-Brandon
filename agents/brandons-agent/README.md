# Brandon's Agent

Brandon's primary automation agent for NF6 Family Office operations.

## Overview

This agent handles property management automation, booking workflows, financial calculations, and operational tasks for the NF6 Family Office ecosystem.

## Structure

```
brandons-agent/
├── config.json          # Agent configuration and capabilities
├── package.json         # Dependencies (telegraf, dotenv)
├── .env.example         # Environment variables template
├── .gitignore           # Ignores node_modules/ and .env
├── README.md            # This file
├── knowledge/           # LLM knowledge base
│   ├── README.md        # Knowledge store documentation
│   ├── nf6-context.md   # NF6 domain knowledge and business rules
│   └── prompts.md       # System prompts and instructions
└── src/                 # Agent source code
    ├── index.js         # Core agent class (knowledge + calculations)
    └── telegram.js      # Telegram bot integration (Open Claw)
```

## Knowledge Store

The `knowledge/` directory is the LLM knowledge base for this agent. It contains:

- **Domain context** — Business rules, property data, financial models, and operational procedures specific to NF6.
- **System prompts** — Instructions and persona definitions that guide the agent's behavior.
- **Reference data** — Static datasets the agent can reference during operations.

To add knowledge, create markdown or JSON files in the `knowledge/` directory and reference them in `config.json`.

## Capabilities

| Capability | Description |
|-----------|-------------|
| Property Management | CRUD operations and data retrieval for properties |
| Booking Automation | Automate booking creation, updates, and status tracking |
| Financial Calculations | Gross/net revenue, platform fees, cleaning fees |
| Data Retrieval | Query bookings, invoices, and payment history |
| Report Generation | Generate summaries and financial reports |

## Telegram Bot (Open Claw)

The agent runs as a Telegram bot via the [Telegraf](https://telegraf.js.org/) framework.

### Setup

1. Get your bot token from [@BotFather](https://t.me/BotFather) on Telegram (use your existing Open Claw bot, or create a new one).
2. Create your `.env` file:
   ```bash
   cd agents/brandons-agent
   cp .env.example .env
   ```
3. Paste your bot token into `.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   ```
4. Install dependencies and start:
   ```bash
   npm install
   npm start
   ```

### Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and menu |
| `/help` | Show all available commands |
| `/bookings` | View all current bookings |
| `/revenue` | YTD financial summary |
| `/calculate <nights> <rate>` | Calculate net income for a booking |
| `/properties` | View property details |
| `/status` | Agent status and loaded knowledge |

The bot also responds to free-text messages with keyword detection for bookings, revenue, and properties.

## Configuration

See `config.json` for full agent settings including model, token limits, and capability declarations.
