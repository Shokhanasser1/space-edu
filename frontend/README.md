# UZ COSMOS — front end

React 19 + Vite. Talks to the Django API in `../backend`.

## Run locally

**Prerequisites:** Node.js 20, and the backend running on port 8000.

```bash
npm install
cp .env.example .env.local     # VITE_API_URL / VITE_WS_URL
npm run dev                    # http://localhost:3000
```

The Gemini key is **not** set here. It lives on the backend (`apps/ai`) — Vite
inlines every `VITE_*` variable into the public bundle, so a key put here is
readable by every visitor.

## The rest of the scripts

| | |
|---|---|
| `npm test` | Vitest. Run `npm run build` first — `src/bundleSecrets.test.js` reads `dist/`. |
| `npm run build` | Production bundle into `dist/`. |
| `npm run content:export` | Regenerate the learn fixture from `src/data/*TopicsData.js`. Required after editing curriculum data, or CI fails. |
| `npm run check:locales` | All three locale files must carry the same keys. |
| `npm run assets:compress` | Texture compression. Linux or WSL only — libvips fails on Windows. |

There is no deployment configuration in this repository. See
`docs/HANDOVER.md` for what has to be decided before there is one again.
