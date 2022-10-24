FROM node:18-alpine as base
WORKDIR /home/node/app

COPY package*.json ./

RUN yarn install

COPY tsconfig.json ./
COPY src ./src
COPY .env ./

# Add any additional env files etc. here


FROM base as production

ENV NODE_PATH=./dist

RUN yarn build
