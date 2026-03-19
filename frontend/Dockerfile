FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Next.js inlines NEXT_PUBLIC_* at build time; Railway passes it as build arg
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN npm run build

EXPOSE 3000

# Production: bind to 0.0.0.0; fixed port 3000 (Railway maps public → 3000)
ENV NODE_ENV=production
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 npm run start -- -p 3000"]
