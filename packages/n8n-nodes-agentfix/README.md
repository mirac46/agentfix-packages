# n8n-nodes-agentfix

n8n community node for [AgentFix](https://agentfix.com.tr). Install once, add an API token, cover the user panel: RAG, patients, appointments, call notes, offers, WhatsApp and dashboard.

## Install in n8n

1. Open **Settings → Community Nodes → Install**.
2. Package name: `n8n-nodes-agentfix`
3. Create an **AgentFix API** credential:
   - Base URL: `https://agentfix.com.tr`
   - API Token: User panel → **API Access** → `rag:read`, `rag:write`, `customers:write`, `appointments:write`

## Agent write

**Ingest → Save Conversation** writes the patient (phone-deduplicated), appointment and call note.

Self-hosted:

```bash
cd ~/.n8n/custom
npm install n8n-nodes-agentfix
```

SDK: [`agentfix-sdk`](https://www.npmjs.com/package/agentfix-sdk)
