#!/bin/bash

echo "Stopping containers..."
docker-compose down

echo "Removing PostgreSQL volume..."
docker volume rm hopalong-backend_postgres_data

echo "Starting containers..."
docker-compose up -d

echo "Done! PostgreSQL data has been reset."
