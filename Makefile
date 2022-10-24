up:
	docker-compose up -d
up-prod:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
down:
	docker-compose down
view:
	docker logs -f t3-fastify-docker
build:
	docker-compose build
do:
	make build
	make up
	make view
