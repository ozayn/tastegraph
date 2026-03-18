FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

# Production: use $PORT for Railway; defaults to 3000 for local Docker
CMD ["sh", "-c", "npm run start -- -p ${PORT:-3000}"]
