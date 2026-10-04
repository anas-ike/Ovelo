FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN npm install
COPY . .
RUN npx prisma generate

FROM base AS api
RUN npm run build:shared && npm run build:api
EXPOSE 4000
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]

FROM base AS worker
RUN npm run build:shared && npm run build:worker
CMD ["node", "--import", "tsx", "apps/worker/src/index.ts"]

FROM base AS web-build
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build:shared && npm run build:web

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
