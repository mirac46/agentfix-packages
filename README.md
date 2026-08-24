# agentfix-packages

[![CI](https://github.com/mirac46/agentfix-packages/actions/workflows/ci.yml/badge.svg)](https://github.com/mirac46/agentfix-packages/actions/workflows/ci.yml)
[![Release](https://github.com/mirac46/agentfix-packages/actions/workflows/release.yml/badge.svg)](https://github.com/mirac46/agentfix-packages/actions/workflows/release.yml)
[![npm agentfix-sdk](https://img.shields.io/npm/v/agentfix-sdk?label=agentfix-sdk)](https://www.npmjs.com/package/agentfix-sdk)
[![npm n8n-nodes-agentfix](https://img.shields.io/npm/v/n8n-nodes-agentfix?label=n8n-nodes-agentfix)](https://www.npmjs.com/package/n8n-nodes-agentfix)

AgentFix ekosistemi için resmi paket monorepo'su. Site (`website/`) bu repoda yoktur.

## Paketler

| Paket | Versiyon | Ne işe yarar |
|---|---|---|
| [`agentfix-sdk`](./packages/agentfix-sdk) | 0.1.2 | TypeScript SDK — herhangi bir Node.js projesinden RAG, CRM, ingest |
| [`n8n-nodes-agentfix`](./packages/n8n-nodes-agentfix) | 0.1.2 | n8n community node — drag-and-drop entegrasyon |

## Yayın

Tag bazlı otomatik npm publish — [RELEASING.md](./RELEASING.md)

```bash
npm version patch -w agentfix-sdk
npm version patch -w n8n-nodes-agentfix
git add packages/*/package.json
git commit -m "chore: release v0.1.1"
git tag v0.1.1
git push origin main --tags
```

## Geliştirme

```bash
npm install
npm run build
npm test
```
