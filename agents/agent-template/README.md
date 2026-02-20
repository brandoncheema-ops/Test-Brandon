# Agent Name

> Replace this with a one-line description of your agent.

## Overview

Describe what this agent does, its purpose, and how it fits into the NF6 ecosystem.

## Structure

```
my-new-agent/
├── config.json          # Agent configuration and capabilities
├── README.md            # This file
├── knowledge/           # LLM knowledge base
│   └── README.md        # Knowledge store documentation
└── src/                 # Agent source code
    └── index.js         # Main entry point
```

## Knowledge Store

Describe what knowledge this agent uses and how to add new knowledge files.

## Capabilities

| Capability | Description |
|-----------|-------------|
| Example | Describe what this capability does |

## Setup

1. Copy this template: `cp -r agents/agent-template agents/my-new-agent`
2. Update `config.json` with your agent's details.
3. Add knowledge files to `knowledge/`.
4. Implement your agent logic in `src/index.js`.
5. Register your agent in `agents/README.md`.
