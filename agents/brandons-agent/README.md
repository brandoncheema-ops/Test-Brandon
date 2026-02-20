# Brandon's Agent

Brandon's primary automation agent for NF6 Family Office operations.

## Overview

This agent handles property management automation, booking workflows, financial calculations, and operational tasks for the NF6 Family Office ecosystem.

## Structure

```
brandons-agent/
├── config.json          # Agent configuration and capabilities
├── README.md            # This file
├── knowledge/           # LLM knowledge base
│   ├── README.md        # Knowledge store documentation
│   ├── nf6-context.md   # NF6 domain knowledge and business rules
│   └── prompts.md       # System prompts and instructions
└── src/                 # Agent source code
    └── index.js         # Main agent entry point
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

## Configuration

See `config.json` for full agent settings including model, token limits, and capability declarations.
