---
name: client_memory
description: View or update a client's persistent memory_md.
triggers:
  - "show memory for {client}"
  - "what do you know about {client}"
  - "client notes for {client}"
  - "update memory: {note}"
parameters:
  client:
    type: string
    description: Client company name or partial match
  note:
    type: string
    description: Free-text note to add to the memory
---

# Client memory

Each client has a persistent markdown-style memory file (`clients.memory_md`)
with sections: Project History, Negotiation Notes, Open Questions, Next Action.
The agent reads and writes this file across every interaction with that client.

## Viewing memory

When the operator asks "what do you know about {client}":

1. Call `getClientMemory` MCP tool with `client_name: {client}`. Fuzzy-match against `clients.company_name`.
2. Render the markdown back to the operator with light formatting. Do not summarize — show the actual sections so the operator can see the source of truth.
3. If multiple clients match, list the top three and ask which.

## Updating memory

When the operator says "update memory: {note}":

1. Call `updateClientMemory` MCP tool with `client_id` + `diff_text`. The MCP handler proposes a structured diff (which section the note belongs in) and surfaces it to the operator for approval.
2. Memory updates are HITL — the operator must confirm the diff before it lands.
3. After approval, the worker writes the updated `memory_md` and audit-logs the change.

# Constraints

- Memory is per-client, not global. Don't merge across clients.
- The four-section format (Project History / Negotiation Notes / Open Questions / Next Action) is canonical — preserve it.
- Memory updates fire `client/memory-updated` events that the dashboard subscribes to via Realtime.
