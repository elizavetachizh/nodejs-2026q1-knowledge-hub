# Stage 1: Development
FROM node:24-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Stage 2: Build
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=development /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Prune development dependencies to keep the image small
RUN npm prune --production


# Stage 3: Production
FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Switch to non-root user
USER appuser

EXPOSE 4000

CMD ["node", "dist/main"]