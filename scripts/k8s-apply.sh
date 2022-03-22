#!/bin/sh

set -e

export APP="clinq-bridge-outlook"
export PROJECT_ID="clinq-services"
export IMAGE="eu.gcr.io/$PROJECT_ID/$APP:latest"
export GITHUB_SHA=$(git rev-parse --short HEAD)
export DOMAIN="outlook-contacts.bridge.clinq.com"

kubectl kustomize k8s/template | envsubst > k8s/prod.yml
kubectl apply -f k8s/prod.yml
