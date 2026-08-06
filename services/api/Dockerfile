FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8083
EXPOSE 8083
CMD ["node", "src/server.js"]
