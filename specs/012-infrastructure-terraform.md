# 012 - Infrastructure as Code (Terraform)

## Feature Name
GCP Infrastructure Provisioning with Terraform

## Description
Terraform configuration that provisions the complete GCP infrastructure for the Hooklab platform including Firebase project setup, Firestore database, Cloud Run service, Artifact Registry, Firebase Hosting, custom domain mapping, service accounts, and Workload Identity Federation for keyless GitHub Actions CI/CD.

## User Stories
- As a DevOps engineer, I want to provision all infrastructure from code, so that environments are reproducible and auditable.
- As a DevOps engineer, I want keyless CI/CD authentication, so that no long-lived service account keys need to be stored.
- As a DevOps engineer, I want modular Terraform code, so that I can manage infrastructure components independently.

## Components Involved
- `terraform/main.tf` -- Root module with provider config and module composition
- `terraform/variables.tf` -- Input variable definitions
- `terraform/outputs.tf` -- Output values for CI/CD integration
- `terraform/terraform.tfvars.example` -- Example variable values
- `terraform/.gitignore` -- Terraform state and variable files excluded
- `terraform/modules/firebase/main.tf` -- Firebase project, Auth, Firestore, Artifact Registry
- `terraform/modules/cloud-run/main.tf` -- Cloud Run service, IAM, domain mapping
- `terraform/modules/service-accounts/main.tf` -- CI/CD and runtime SAs, Workload Identity Federation
- `terraform/modules/hosting/main.tf` -- Firebase Hosting site and configuration
- `terraform/modules/domain/main.tf` -- Custom domain, optional Cloud DNS

## Terraform Modules

### 1. Firebase Module (`modules/firebase/`)
- Firebase project initialization
- Identity Platform config (anonymous + email auth)
- Firestore database (native mode)
- Artifact Registry repository (Docker format, 10 latest images retained)

### 2. Service Accounts Module (`modules/service-accounts/`)
- **CI/CD SA** (`github-actions-ci-cd`): firebase.admin, run.admin, iam.serviceAccountUser, artifactregistry.writer, cloudbuild.builds.builder, firebasehosting.admin, secretmanager.secretAccessor
- **Cloud Run SA** (`hooklab-cloud-run`): datastore.user, secretmanager.secretAccessor, logging.logWriter, monitoring.metricWriter, cloudtrace.agent
- **Workload Identity Federation**: GitHub Actions OIDC pool with repository-scoped condition

### 3. Hosting Module (`modules/hosting/`)
- Firebase Hosting site creation
- SPA rewrite configuration (`** -> /index.html`)
- Security headers (nosniff, DENY frames, XSS protection, referrer policy, permissions policy)
- Cache headers for static assets (1 year, immutable)

### 4. Cloud Run Module (`modules/cloud-run/`)
- Cloud Run v2 service with configurable scaling (min/max instances), CPU, memory
- Health check probes (startup + liveness on `/api/health`)
- Public access (allUsers invoker role)
- Gen2 execution environment
- 300-second request timeout
- CPU idle and startup CPU boost enabled
- Image tag ignored in lifecycle (managed by CI/CD)
- Optional API domain mapping

### 5. Domain Module (`modules/domain/`)
- Firebase Hosting custom domain
- Optional Cloud DNS managed zone with DNSSEC
- A record pointing to Firebase Hosting IP (199.36.158.100)
- TXT record for domain verification

## GCP APIs Enabled
firebase, firebaserules, firebasehosting, firestore, identitytoolkit, cloudbuild, run, artifactregistry, iam, iamcredentials, cloudresourcemanager, serviceusage, dns, compute, secretmanager

## Key Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `project_id` | GCP project ID | required |
| `region` | GCP region | us-central1 |
| `github_org` | GitHub org/username | required |
| `github_repo` | GitHub repository | webhook |
| `ar_repo` | Artifact Registry repo ID | hooklab |
| `firebase_site_id` | Firebase Hosting site ID | required |
| `domain_name` | Custom domain | "" |
| `cloud_run_service_name` | Cloud Run service | hooklab-api |
| `cloud_run_min_instances` | Min instances | 0 |
| `cloud_run_max_instances` | Max instances | 10 |
| `cloud_run_cpu` | CPU per instance | 1 |
| `cloud_run_memory` | Memory per instance | 512Mi |

## Key Outputs
Outputs are designed to be set as GitHub Actions secrets/variables:
- `wif_provider` -> GitHub secret `WIF_PROVIDER`
- `gcp_sa_email` -> GitHub secret `GCP_SA_EMAIL`
- `gcp_project_id` -> GitHub variable `GCP_PROJECT_ID`
- `gcp_region` -> GitHub variable `GCP_REGION`
- `cloud_run_service` -> GitHub variable `CLOUD_RUN_SERVICE`
- `ar_repo` -> GitHub variable `AR_REPO`
- `firebase_site_id` -> GitHub variable `FIREBASE_SITE_ID`

## Business Rules
- Terraform state backend (GCS bucket) is commented out and must be manually configured
- Cloud Run scales to zero by default (min_instances = 0)
- Artifact Registry cleanup retains 10 most recent images
- Workload Identity Federation is scoped to a specific GitHub repository
- Firebase Hosting uses Firebase IP (199.36.158.100) for A records

## Dependencies
- GCP project with billing enabled
- Terraform >= 1.5
- Google provider ~> 6.0
- GitHub repository for WIF

## Current Status
**Implemented** -- All modules are defined. The GCS state backend is commented out (requires manual bucket creation before use).

## Technical Notes
- The Terraform uses both `google` and `google-beta` providers since many Firebase resources require the beta provider.
- `disable_on_destroy = false` on API enablements prevents accidental service disruption.
- Cloud Run image changes are excluded from Terraform lifecycle management (`ignore_changes`) since images are updated by CI/CD.
- The Artifact Registry cleanup policy uses `cleanup_policy_dry_run = false` to actually delete old images.
- DNSSEC is enabled on the optional Cloud DNS zone.
