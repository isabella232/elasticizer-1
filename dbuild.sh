#!/usr/bin/env bash

ARTIFACT_NAME=`node -e 'console.log(require("./package.json").dockerName)'`
ARTIFACT_VERSION=`node -e 'console.log(require("./package.json").version)'`
DOCKER_REPO_NAME="docker-internal.forgerock.io/backstage"
TAG="${DOCKER_REPO_NAME}/${ARTIFACT_NAME}:${ARTIFACT_VERSION}"

docker build --tag "${TAG}" .
docker push "${TAG}"
