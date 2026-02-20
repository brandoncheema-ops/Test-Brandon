# Agents Directory

This directory is the central registry for all agents in the NF6 Family Office ecosystem. Each agent has its own subdirectory containing its configuration, source code, and documentation.

## Directory Structure

```
agents/
├── README.md                  # This file - registry overview
├── agent-template/            # Template for creating new agents
│   ├── README.md
│   ├── config.json
│   ├── knowledge/             # Knowledge store template
│   └── src/
├── brandons-agent/            # Brandon's Agent
│   ├── README.md
│   ├── config.json
│   ├── knowledge/             # LLM knowledge base (domain context, prompts)
│   │   ├── nf6-context.md
│   │   └── prompts.md
│   └── src/
│       └── index.js
└── <new-agent>/               # Future agents go here
```

## Registered Agents

| Agent | Description | Status | Owner |
|-------|-------------|--------|-------|
| [brandons-agent](./brandons-agent/) | Brandon's primary automation agent for NF6 operations | Active | Brandon |

## Adding a New Agent

1. Copy the `agent-template/` directory and rename it to your agent's name:
   ```bash
   cp -r agents/agent-template agents/my-new-agent
   ```
2. Update `config.json` with your agent's details (name, description, version, capabilities).
3. Add your agent's source code under `src/`.
4. Update the **Registered Agents** table above with your new entry.
5. Commit and push your changes.

## Conventions

- Agent directory names use **kebab-case** (e.g., `brandons-agent`, `data-sync-agent`).
- Every agent must include a `config.json` and a `README.md`.
- Source code lives under `src/` within each agent directory.
- Keep agent-specific dependencies in the agent's own `package.json` if needed.
