FROM node:20-alpine

WORKDIR /app

# Install deps first so this layer caches across source changes
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV API_PORT=3000
EXPOSE 3000

# Don't run as root
USER node

CMD ["node", "server.js"]
