# Stage 1: Build
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build


# Stage 2: Production
FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Installing curl for alpine to check if the server is running
RUN apk add --no-cache curl 

COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Switch to non-root user
USER node
EXPOSE 4000
CMD ["node", "dist/src/main"]