FROM node:13-alpine

WORKDIR /usr/src/app

RUN npm install typescript -g
RUN npm install ts-node -g

COPY /server/package*.json ./server/
RUN cd server && npm install

COPY . .

ENV PORT=8080
EXPOSE ${PORT}

WORKDIR /usr/src/app/server
CMD [ "ts-node", "server.ts" ]