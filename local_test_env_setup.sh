#!/bin/bash

# Env variables
export PROJECT_ID=phading-dev
export INSTANCE_ID=test
export DATABASE_ID=test
export ACCOUNT_AVATAR_BUCKET_NAME=avatar-test
export ACCOUNT_AVATAR_PUBLIC_ACCESS_DOMAIN=https://test.domain/

# GCP auth
gcloud auth application-default login

# Spanner
gcloud spanner instances create test --config=regional-us-central1 --description="test" --edition=STANDARD --processing-units=100
gcloud spanner databases create test --instance=test
npx spanage update db/ddl -p phading-dev -i test -d test
