# Stage 1: Build
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build


# Stage 2: Production
FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Installing curl for alpine to check if the server is running
RUN apk add --no-cache curl 

COPY --from=build /app/package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist

# AppLoggingService creates LOG_DIR (default ./logs); non-root must own /app
RUN mkdir -p /app/logs && chown -R node:node /app

# Switch to non-root user
USER node
EXPOSE 4000
CMD ["node", "dist/src/main"]