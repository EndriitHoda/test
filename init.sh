#!/bin/bash

echo "Building the gradle builder as a pre-requisite..."
docker build -t gradle-builder:latest ./gradle-builder

echo "Building services on compose.yaml"
docker compose build

echo "Starting services..."
docker compose up -d