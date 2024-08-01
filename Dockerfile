FROM public.ecr.aws/docker/library/node:20

WORKDIR /app
COPY . .
RUN npm install
RUN npx tsc

EXPOSE 80
CMD ["node", "main"]
