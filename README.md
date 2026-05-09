# Knowledge Hub

## Downloading

```
git clone {repository URL}
```

## Installing NPM modules

```
npm install
```

## Running application

```
npm start
```

After starting the app on port (4000 as default) you can open
in your browser OpenAPI documentation by typing http://localhost:4000/doc/.

## Testing

After application running open new terminal and enter:

To run all tests without authorization

```
npm run test
```

To run only one of all test suites

```
npm run test -- <path to suite>
```

To run all test with authorization

```
npm run test:auth
```

To run only specific test suite with authorization

```
npm run test:auth -- <path to suite>
```

To run refresh token tests

```
npm run test:refresh
```

To run RBAC (role-based access control) tests

```
npm run test:rbac
```

## Docker

Build and run the application with Docker Compose:

```
docker compose up --build
```

Application: `http://localhost:4000`  
Swagger: `http://localhost:4000/doc`

Stop containers:

```
docker compose down
```

## Prisma and Database

Generate Prisma client:

```
npx prisma generate
```

Create/apply migrations in development:

```
npx prisma migrate dev
```

Apply existing migrations (without creating new ones):

```
npx prisma migrate deploy
```

Seed the database:

```
npx prisma db seed
```

Reset DB and run migrations + seed:

```
npx prisma migrate reset
```

Optional DB inspection:

```
npx prisma studio
```

## DATABASE_URL

Use different `DATABASE_URL` values depending on where the app runs.

- Local app + Docker DB:

```
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydb?schema=public"
```

- Docker app + Docker DB:

```
DATABASE_URL="postgresql://myuser:mypassword@db:5432/mydb?schema=public"
```

`localhost` works from your host machine. `db` works from inside Docker Compose network.

## Gemini AI

Follow these steps or AI routes will fail (503 / 500) or never reach Google.

### 1. Prerequisites

- A **PostgreSQL** database with migrations applied and (optionally) seed data (`npx prisma migrate deploy`, `npx prisma db seed`), so `/ai/articles/:id/...` can load articles.
- **`GEMINI_API_KEY` + `GEMINI_MODEL`** — see step 2.
- **`GEMINI_API_BASE_URL`** — see step 3.
- **`AI_RATE_LIMIT_RPM`**, **`AI_RATE_WINDOW_MS`**, **`AI_CACHE_TTL_SEC`** — see step 5(rate limit, cache TTL, usage notes).

---

### 2. Gemini API key + Gemini model

1. Open **[Google AI Studio](https://aistudio.google.com)** and sign in.
2. Go to **Get API key** (or **API keys**).
3. Create/select a Google Cloud project if prompted.
4. **Create API key** and copy it once (you usually cannot view it later).
5. Put it **only** in `.env`:

   ```
   GEMINI_API_KEY=<paste-your-key-here>
   ```

Set **`GEMINI_MODEL`** in `.env`. It must match a model identifier your key can call (examples: `gemini-2.0-flash`, `gemini-2.5-flash`).

---

### 3. Base URL — two supported modes

You must choose **one** base URL style and set **`GEMINI_API_BASE_URL`** accordingly (**no trailing slash** at the base; the suffix below is intentional).

#### A) Call Google directly (no Worker)

```env
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/models
```

Works if your environment can reach Google’s API endpoints over HTTPS. You can use Fiddler for testing

#### B) Via your Cloudflare Worker (reverse proxy to Google)

Recommended when you proxy traffic through **`workers.dev`** using the code in **`workers/`** (see **`workers/wrangler.toml`** and **`workers/gemini-proxy.worker.js`**).

1. Install Wrangler CLI: `npm install -g wrangler` (or use `npx wrangler`).
2. `cd workers && wrangler login`
3. `npx wrangler deploy`  
   Wrangler prints the worker URL when done, e.g. `https://gemini-proxy.<account>.workers.dev`.
4. In **`.env`**, point the Nest app at the **same API path segment** Google uses:

   ```
   GEMINI_API_BASE_URL=https://gemini-proxy.<account>.workers.dev/v1beta/models
   ```

   Optional: **`GEMINI_PROXY_INJECT_KEY=true`** plus **`wrangler secret put GEMINI_API_KEY`** lets the Worker add the key server-side (then omit `key` from the app URL — requires matching app code).

The Swagger base URL stays `http://localhost:4000` (or **`PORT`**). Only outgoing Gemini HTTP uses **`GEMINI_API_BASE_URL`**.

---

### 4. AI cache, rate limits, and usage tracking

These variables are listed in **`.env.example`**; set them in **`.env`** and restart the app.

| Variable | Role |
|----------|------|
| **`AI_RATE_LIMIT_RPM`** | Maximum number of allowed calls to each `/ai/...` route **per client** within one rate-limit **window** (default **`20`**). |
| **`AI_RATE_WINDOW_MS`** | Length of that window in **milliseconds** (default **`60000`** — one minute). This is **not** the same as cache lifetime. |
| **`AI_CACHE_TTL_SEC`** | **Seconds** to keep **in-memory** responses for **`POST .../summarize`** and **`POST .../translate`** only. Cache keys include the article id, request parameters, and the article’s **`updatedAt`**, so edits to the article invalidate the logical key. Default **`300`**. **`/analyze`** and **`POST /ai/generate`** are **not** cached. |

**Upstream Gemini:** transient **429** responses from Google are retried inside **`GeminiHttpService`** with exponential backoff (see code). Persistent overload still surfaces as **503** with a generic message.

#### AI routes (OpenAPI tag **AI**)

| Method | Path | Body / access |
|--------|------|----------------|
| `GET` | `/ai/usage` | **Bearer JWT** (VIEWER+). Counters, tokens, latency, cache ratio, diagnostics. No throttle. |
| `POST` | `/ai/articles/{id}/summarize` | **Bearer JWT** (VIEWER+). Optional **`maxLength`**: … |
| `POST` | `/ai/articles/{id}/translate` | **Bearer JWT** (VIEWER+). **`targetLanguage`** … |
| `POST` | `/ai/articles/{id}/analyze` | **Bearer JWT** (VIEWER+). Optional **`task`**: … |
| `POST` | `/ai/generate` | **No auth.** **`prompt`** (required), optional **`context`**. |
---

### 5. Run the app after `.env` is ready

Local:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Swagger: `http://localhost:4000/doc` → **Authorize** once for Bearer if you call **`POST /ai/articles/{articleId}/...`** or **`GET /ai/usage`** → **`POST /ai/generate`** works **without** token (see §5).

Docker Compose reads **`.env`** via `env_file`:

```bash
docker compose up --build
```

Then check env inside app (optional):

```bash
docker compose exec app env | grep GEMINI
```

---

### 6. Smoke test (outside Swagger)

Minimal `curl` shape (adjust host, model, key, Worker URL as needed):

```bash
curl -sS -X POST \
  "${GEMINI_API_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"role":"user","parts":[{"text":"Say OK"}]}]}'
```

Expect JSON with **`candidates`**. **`429`** = quota/exhaustion on Google side; **`fetch failed`** with proxy set = proxy not reachable (see §6 — HTTPS proxy).

---

## Docker Hub Image

Replace the placeholder with your published image link:

`https://hub.docker.com/repository/docker/elizavetachizh/nodejs-2026q1-knowledge-hub-app`

## Security Scan

Image scanned with Docker Scout:

```
docker scout cves nodejs-2026q1-knowledge-hub-app:latest
```

Last scan result:
- Critical: `0`
- High: `32`
- Medium: `21`
- Low: `5`
