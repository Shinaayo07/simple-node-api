# simple-node-api

`customer-api` is a small Express REST API (products/customers/orders, in-memory store) built for the Prembly DevOps practical assessment. It ships with Prometheus metrics, OpenTelemetry tracing, and structured logging, and is deployed identically to two environments — **AKS** (real cloud) and **kind** (local mirror) — via one Docker image, one Helm chart, and ArgoCD.

## Architecture

- **App** (`app/`): Express + Helmet, `/health` (liveness) and `/ready` (readiness), `/metrics` (Prometheus), OpenTelemetry auto-instrumentation, pino logs.
- **CI** (`.github/workflows/application-CI.yaml`): lint/test/audit → Semgrep/TruffleHog/Trivy scans → build → sign (cosign, Azure Key Vault) → push to Docker Hub (`docker.io/shina371/simple-node-api`).
- **Delivery split across two branches**, to keep bot commits and human commits from ever colliding:
  - `main` — where developers work: app source, Helm chart source, Terraform, ArgoCD manifests.
  - `k8s-release` — bot-only. CI writes the current image digest and chart version here after every relevant build; **ArgoCD watches this branch, never `main`**.
- **Helm chart** (`helm/customer-api/`): one chart, two value overlays (`values.yaml` for AKS, `values-kind.yaml` layered on top for kind). Also published as a versioned OCI artifact (`oci://registry-1.docker.io/shina371/customer-api`) via `.github/workflows/helm-publish.yaml`, independent of ArgoCD, for anyone who wants to `helm install` it directly.
- **GitOps** (`argocd/`): app-of-apps pattern. One root `Application` per environment (`argocd-root-app.yaml` / `argocd-root-app-kind.yaml`) applied by hand once; everything else — customer-api's own `Application`, and the optional Prometheus/Loki/Tempo/Grafana/Alloy stack — syncs itself from git from then on.
- **Infra** (`terraform/`): `bootstrap/` (remote state storage), `cluster/` (AKS + network), `kind/` (full local platform: kind cluster, Calico, ingress-nginx, cert-manager, External Secrets, Prometheus Operator CRDs, and ArgoCD itself).
- **IaC scanning** (`.github/workflows/iac-CI.yaml`): Checkov against `terraform/` and `helm/` on every relevant change, currently soft-fail while the initial findings backlog is triaged.

## How to run the application

### Locally (kind)

Prerequisites: Docker running, [kind](https://kind.sigs.k8s.io/), Terraform ≥ 1.9, `kubectl`.

```bash
cd terraform/kind
terraform init
terraform apply -auto-approve   # provisions the cluster + platform (Calico, ingress-nginx, cert-manager, ESO, ArgoCD)
```

**On a genuinely first-ever apply (no `.kubeconfig` yet in this directory), run `terraform apply -auto-approve` a second time.** This isn't a flaky failure — Terraform configures the `kubectl`/`helm` providers *before* `kind_cluster.this` has a chance to write the kubeconfig they need, so the first pass reliably fails on the Calico/ingress-nginx/etc. resources with a `dial tcp` or `http://localhost/api` style error. The cluster itself is fine at that point; a second apply picks up the now-valid kubeconfig and finishes the rest. Also expect the first apply to take a while (10–20+ minutes) pulling several Helm charts' images for the first time — that's normal, not a hang.

```bash
export KUBECONFIG=$(pwd)/.kubeconfig
kubectl apply -f ../../argocd-root-app-kind.yaml
kubectl get applications -n argocd -w   # wait for customer-api to reach Synced/Healthy
```

```bash
curl -k https://customer-api.127.0.0.1.nip.io/health
curl -k https://customer-api.127.0.0.1.nip.io/api/products
```

Tear down with `terraform destroy -auto-approve` from `terraform/kind`. If it fails partway with `failed to delete release: prometheus-operator-crds` (Helm can get stuck uninstalling CRDs that still have live instances), run `terraform state rm helm_release.prometheus_operator_crds` and destroy again — safe here since the very next resource it destroys is the kind cluster itself, deleting the underlying Docker containers wholesale regardless of that release's state.

### Cloud (Azure/AKS)

```bash
cd terraform/bootstrap
terraform init && terraform apply -auto-approve   # remote state storage account

cd ../cluster
cp backend.hcl.example backend.hcl   # fill in from bootstrap's output
terraform init -backend-config=backend.hcl
cp terraform.tfvars.example terraform.tfvars   # set authorized_ip_ranges to your own IP
terraform apply -auto-approve

az aks get-credentials --resource-group <resource_group_name output> --name <cluster_name output>
```

At this point the AKS cluster exists, but **ArgoCD isn't installed yet** — see Assumptions below. Once ArgoCD is running in the cluster, apply the root app the same way as kind:

```bash
kubectl apply -f argocd-root-app.yaml
```

## How to deploy it

Deployment is push-triggered, not manual:

1. Push to `main` (app change, chart change, or both).
2. `application-CI.yaml` builds, scans, signs, and pushes the image, then bumps the digest onto `k8s-release`. `helm-publish.yaml` bumps the chart version, publishes it to Docker Hub as an OCI artifact, and syncs the chart onto `k8s-release`.
3. ArgoCD (`automated: { prune: true, selfHeal: true }`) picks up the change on `k8s-release` on its own — no manual `argocd app sync` needed.

## How to rollback

`k8s-release` is what ArgoCD actually deploys from, so a rollback is a normal git operation there — revert the offending commit on `k8s-release` and push; ArgoCD's `selfHeal` re-syncs to the reverted state automatically. Equivalently, `argocd app rollback customer-api <REVISION_ID>` against one of the last 5 tracked revisions (`revisionHistoryLimit: 5`) works without touching git at all. Because the image is digest-pinned (not a floating tag), a rollback is always to an exact, previously-verified build — never an ambiguous "whatever `latest` happened to be."

## How to monitor it

Prometheus scrapes customer-api via its `ServiceMonitor` (`/metrics`, 15s interval). A Grafana dashboard ships with the chart itself (`helm/customer-api/templates/grafana-dashboard-configmap.yaml`, auto-discovered by Grafana's sidecar) covering the four signals this assessment asks for:

| Signal | Metric |
|---|---|
| Availability | `up{job="customer-api"}` |
| HTTP errors | `rate(http_requests_total{status_code=~"5.."}[5m])` ratio |
| CPU / memory | `container_cpu_usage_seconds_total` / `container_memory_working_set_bytes` per pod |
| Latency | `histogram_quantile` p50/p95/p99 on `http_request_duration_seconds` |

Suggested alert thresholds are documented directly in each panel's description rather than wired as `PrometheusRule` objects — visualization only, by design, for now. Reach Grafana/Prometheus/ArgoCD via `kubectl port-forward` (no public ingress for platform tools, deliberately — see `argocd/monitoring/`).

## Important assumptions made

- **AKS's platform layer isn't automated yet.** `terraform/cluster` provisions the AKS cluster and network only — unlike `terraform/kind`, it does not install ArgoCD, ingress-nginx, cert-manager, or External Secrets. Those need a manual bootstrap on AKS today.
- **No real domain/Key Vault yet.** `values.yaml`'s ingress host, Let's Encrypt issuer, and Azure Key Vault fields are placeholders (`REPLACE_WITH_...`) pending a real AKS deployment.
- **`k8s-release` is created once, manually, from `main`**, before the first deploy — it isn't self-bootstrapping.
- **No real secret exists yet.** The `ExternalSecret`/`SecretStore` wiring is fully functional but demo-only (`fake` provider on kind, an empty Key Vault entry on AKS) — there's no actual application secret to sync yet.
- **In-memory store only** — customer-api has no real database; state doesn't persist across restarts, intentionally, for the scope of this assessment.
- **Post-deploy pipeline health check deliberately deferred** — no live AKS cluster exists yet to verify against.
- **Checkov runs soft-fail initially** in `iac-CI.yaml`, pending triage of the first findings pass across `terraform/` and `helm/`.
