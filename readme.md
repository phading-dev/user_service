## Local test setup

### R2

1. Create a bucket named as `avatar-test` bucket in Cloudflare R2.
1. Create or assign a test API token to the bucket.
1. Roll the API token and save access key ID and secret access key locally. Do not commit to codebase.

### Setup

`source local_test_env_setup.sh`
`source .secret.sh`

### TearDown

`source local_test_env_teardown.sh`

## Create deployment and database table

1. Open Google Cloud Shell Editor.
1. Choose project `phading-dev` or `phading-prod`.

1. Run `gcloud container clusters get-credentials core-services --location=us-central1`
1. Run `kubectl create serviceaccount user-service-account --namespace default`
1. Run `gcloud projects add-iam-policy-binding phading-dev --member=principal://iam.googleapis.com/projects/178489203789/locations/global/workloadIdentityPools/phading-dev.svc.id.goog/subject/ns/default/sa/user-service-account --role=roles/spanner.databaseUser --condition=None`, replace `phading-dev` with `phading-prod`, and `178489203789` with `703213718960` for prod env.

1. Run `gcloud iam service-accounts create user-service-builder`
1. Run `gcloud projects add-iam-policy-binding phading-dev --member='serviceAccount:user-service-builder@phading-dev.iam.gserviceaccount.com' --role='roles/cloudbuild.builds.builder' --condition=None`, replacing `phading-dev` with `phading-prod`, if for prod env.
1. Run `gcloud projects add-iam-policy-binding phading-dev --member='serviceAccount:user-service-builder@phading-dev.iam.gserviceaccount.com' --role='roles/container.developer' --condition=None`, replacing `phading-dev` with `phading-prod`, if for prod env.
1. Go to cloud build and set up a new trigger. In source, it asks to set up a GitHub connection. Name it as `phading-dev`. Choose the region `us-central-1`. Choose to install it in a new account `phading-dev`.
1. Name it as `user-service-builder`. Choose region in `us-central-1`. In event, choose `manual invocation`.  In source, choose the repo `user_service` and rename it manually as `user_service`. In configuration, choose `cloud build configuration file` and location as `Repository`. Use the service account created above. Then create.

1. Manually run the build.
