# Build Stage 1
# This build created a staging docker image
#
FROM node:18-slim AS appbuild
WORKDIR /usr/src/app
COPY package.json ./
RUN yarn install
COPY ./src ./src
RUN yarn build
# Build Stage 2
# This build takes the production build from staging build
#
FROM node:18-slim
WORKDIR /usr/src/app
COPY package.json ./
RUN yarn install
COPY --from=appbuild /usr/src/app/dist ./dist
EXPOSE 4000
CMD yarn start
