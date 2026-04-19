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
