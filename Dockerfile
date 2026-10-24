FROM oven/bun:1.4.4-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src

EXPOSE 3051

CMD ["bun", "src/index.js"]
