# KlarParat

Et projekt der implementerer en morgenmotivation-app til børn. Løsningen består af en Fastify/Prisma backend og en React-baseret PWA frontend.

## Struktur

```
app/
  server/   # Fastify + Prisma + OpenAI orkestrering
  client/   # React + Vite PWA
```

## Krav

* Node.js 20+
* pnpm 8+
* OpenAI API-nøgle

## Opsætning

```bash
cp .env.example app/server/.env
# udfyld OPENAI_API_KEY og ADMIN_PIN

cd app/server
pnpm install
pnpm prisma generate
pnpm prisma migrate dev --name init
pnpm dev
```

I et nyt terminalvindue:

```bash
cd app/client
pnpm install
pnpm dev -- --host
```

Frontend er tilgængelig på `http://localhost:5173`, backend på `http://localhost:8787`.

## Test

```bash
cd app/server
pnpm test
```

(Frontend-tests er ikke opsat endnu.)

## Funktioner i backend

* CRUD for børn, opgaver og rutiner med PIN-beskyttelse (`x-admin-pin`).
* LLM-baseret varighedsestimering og talegeneration med fallback-sætninger.
* Sessionstyring, tidslogning og belønning (guld/sølv/bronze).
* Midlertidig caching af TTS-klip via `/api/tts/:clipId`.

## Frontend-overblik

* Simpel admin-side med PIN-gate, listevisning og formularer til børn/opgaver.
* Runner-side hvor en session kan indtastes, opgaver afsluttes og lydbeskeder afspilles.
* PWA-manifest og minimalistisk service worker.

## Videre arbejde

* Udbyg visuelle flows til rutineopsætning og aktivering i UI’et.
* Automatisk nudging i runneren, realtidsstatus og offline-håndtering.
* Udvidet testsuite (API/e2e) samt fejlhåndtering for TTS/LLM.
