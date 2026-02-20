# Knowledge Store

This directory contains the LLM knowledge base for Brandon's Agent. All domain-specific context, instructions, and reference data are stored here so the agent can make informed decisions.

## How It Works

Files in this directory are loaded as context for the agent. The agent references this knowledge when handling requests, making decisions, or generating outputs.

## Files

| File | Purpose |
|------|---------|
| `nf6-context.md` | NF6 Family Office domain knowledge, business rules, property details |
| `prompts.md` | System prompts, persona instructions, and behavioral guidelines |

## Adding New Knowledge

1. Create a new `.md` or `.json` file in this directory.
2. Use clear headings and structured content so the agent can parse it effectively.
3. Update this README with a description of the new file.
4. Reference the file in `../config.json` if it requires special handling.

## Guidelines

- Keep files focused on a single topic or domain area.
- Use markdown for human-readable knowledge; use JSON for structured data.
- Avoid duplicating information — reference other files instead.
- Review and update knowledge regularly to keep it current.
