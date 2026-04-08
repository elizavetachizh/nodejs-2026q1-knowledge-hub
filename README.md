# Knowledge Hub

## Prerequisites

- Git - [Download & Install Git](https://git-scm.com/downloads).
- Node.js - [Download & Install Node.js](https://nodejs.org/en/download/) and the npm package manager.

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
For more information about OpenAPI/Swagger please visit https://swagger.io/.

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

### Debugging in VSCode

Press <kbd>F5</kbd> to debug.

For more information, visit: https://code.visualstudio.com/docs/editor/debugging

## Docker

Build and run the application with Docker Compose:

```
docker compose up --build
```

Application: `http://localhost:4000`  
Swagger: `http://localhost:4000/doc`

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
