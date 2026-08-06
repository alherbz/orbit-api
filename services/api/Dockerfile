FROM node:20.99.99-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=8083
EXPOSE 8083
CMD ["node", "src/server.js"]
