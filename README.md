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

### Auto-fix and format

```
npm run lint
```

```
npm run format
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
- **`GEMINI_API_KEY`** — see step 2.
- **`GEMINI_API_BASE_URL` + `GEMINI_MODEL`** — see steps 3–4.

Copy `.env.example` to `.env` and fill placeholders. Restart the server after edits.

---

### 2. How to obtain a Gemini API key

1. Open **[Google AI Studio](https://aistudio.google.com)** and sign in.
2. Go to **Get API key** (or **API keys**).
3. Create/select a Google Cloud project if prompted.
4. **Create API key** and copy it once (you usually cannot view it later).
5. Put it **only** in `.env`:

   ```
   GEMINI_API_KEY=<paste-your-key-here>
   ```

---

### 3. Which model is used?

Set **`GEMINI_MODEL`** in `.env`. It must match a model identifier your key can call (examples: `gemini-2.0-flash`, `gemini-2.5-flash`). The app builds:

`POST {GEMINI_API_BASE_URL}/{GEMINI_MODEL}:generateContent?key=...`

Keep `GEMINI_MODEL` aligned with any manual `curl`/tests against the API.

---

### 4. Base URL — two supported modes

You must choose **one** base URL style and set **`GEMINI_API_BASE_URL`** accordingly (**no trailing slash** at the base; the suffix below is intentional).

#### A) Call Google directly (no Worker)

```env
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/models
```

Works if your environment can reach Google’s API endpoints over HTTPS.

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

### 5. Optional: HTTPS proxy debugging (undici — `EnvHttpProxyAgent`)

The **`GeminiHttpService`** honours **`HTTP_PROXY`**, **`HTTPS_PROXY`**, **`NO_PROXY`** (see code). Use this **only when** debugging with a tool like Charles/Fiddler that listens as an HTTP CONNECT proxy.

- **`HTTPS_PROXY=http://127.0.0.1:8888`** is valid **only when** something is listening on that host/port (e.g. Fiddler on the same machine).

- Inside **Docker Desktop**, **`127.0.0.1` is inside the container** — your Mac’s proxy is not there. Omit proxy vars unless you know you need MITM debugging; otherwise you get `ECONNREFUSED` when calling Gemini.

You do **not** need **`HTTPS_PROXY`** for the Cloudflare Worker path in section 4B — **`GEMINI_API_BASE_URL`** already targets the Worker over HTTPS.

---

### 6. Run the app after `.env` is ready

Local:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Swagger: `http://localhost:4000/doc` → authenticate → **`POST /ai/articles/{articleId}/summarize`**.

Docker Compose reads **`.env`** via `env_file`:

```bash
docker compose up --build
```

Then check env inside app (optional):

```bash
docker compose exec app env | grep GEMINI
```

---

### 7. Smoke test (outside Swagger)

Minimal `curl` shape (adjust host, model, key, Worker URL as needed):

```bash
curl -sS -X POST \
  "${GEMINI_API_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"role":"user","parts":[{"text":"Say OK"}]}]}'
```

Expect JSON with **`candidates`**. **`429`** = quota/exhaustion on Google side; **`fetch failed`** with proxy set = proxy not reachable (see §5).

---

### 8. Known limitations (typical assignment notes)

- **Free tier quotas** — daily/minute caps; may return **`429`**; waiting or rotating keys/projects may help; paid/billing quotas differ by region/policy.
- **Latency** — first token and regional routing add delay.
- **Regional availability / account settings** affect whether a given key/project can enable **Generative Language API** quotas you see (check Google AI Studio / Cloud console).

---

### 9. Troubleshooting checklist

| Symptom | What to verify |
|---------|----------------|
| **`ECONNREFUSED 127.0.0.1:8888` in logs** | Remove/disable **`HTTPS_PROXY`/`HTTP_PROXY`** or start the proxy listener; adjust for Docker (**`host.docker.internal`**) only if intentional. |
| **`GEMINI_API_KEY is not configured`** | Key missing in **`process.env`** for that process (`docker compose exec app env`). |
| **`503` / overloaded message** | Upstream quotas or outages; inspect logs for **`Gemini upstream HTTP`** lines (response body summarized there). |

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
