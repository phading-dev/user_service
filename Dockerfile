FROM node:20.12.1

WORKDIR /app
COPY . .
RUN npm install
RUN npx tsc

EXPOSE 80
CMD ["node", "main"]
