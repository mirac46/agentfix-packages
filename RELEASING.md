# Yayın Rehberi

Paketler GitHub Actions ile npm'e yayınlanır. Manuel `npm publish` gerekmez — `v*` tag push yeterli.

## Tek seferlik kurulum

1. https://www.npmjs.com/ → Access Tokens → Generate New Token
2. Type: **Automation** (Classic) veya Granular: **Read and write** + **All packages**
3. GitHub repo → Settings → Secrets and variables → Actions
4. Name: `NPM_TOKEN` · Value: token · Add secret

Token sohbete, commit'e veya README'ye yazılmaz.

## Yayın

```bash
npm version patch -w agentfix-sdk
npm version patch -w n8n-nodes-agentfix
```

`n8n-nodes-agentfix` içindeki `dependencies.agentfix-sdk` sürümünü de güncelle.

```bash
git add packages/*/package.json
git commit -m "chore: release v0.1.1"
git tag v0.1.1
git push origin main --tags
```

`v*` tag'i [`.github/workflows/release.yml`](.github/workflows/release.yml) tetikler: build → test → `agentfix-sdk` → 30s bekle → `n8n-nodes-agentfix` → GitHub Release.

## Kontrol

```bash
npm view agentfix-sdk version
npm view n8n-nodes-agentfix version
```
