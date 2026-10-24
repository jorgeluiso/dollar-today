FROM oven/bun:1.4.4-alpine

WORKDIR /app

COPY package.json ./

COPY src ./src

EXPOSE 3051

CMD ["bun", "src/index.js"]
