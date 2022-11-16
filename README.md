# T3 FASTIFY x PRISMA TEMPLATE

## Usage

Simply press the "Use Template" button in GitHub to create a new repository using this template. Rebuild docker image when changing prisma schema or package.json.

## Main files

- `server.ts` for basic fastify server creation
- `Dockerfile`, `docker-compose.yml` and `docker-compose.prod.yml` for all stuff Docker
- `Makefile` for making those pesky Docker commands all that easier to type
- `env.ts` for env stuffs

NB: edit content found in `package.json` and `docker-compose.yml` according to your project.

## Footnotes

This project uses [T3 gitignore](https://github.com/t3mplates/gitignore) for its `.gitignore` file.

This project does not by default include unit tests (e.g. Ava or Jest), but this functionality can easily be extended & added. Neither does it include a route-management system.
