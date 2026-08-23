# simple-node-api

This application is for the practical assessment interview at Prembly.

`customer-api` (in `app/`) is a small Express REST API with Prometheus metrics,
OpenTelemetry tracing, and structured logging. It's built and deployed the same
way regardless of where it runs - one Docker image
(`docker.io/shina371/simple-node-api`, built/pushed/signed by
`.github/workflows/application-CI.yaml`) and one Helm chart
(`helm/customer-api`), deployed via ArgoCD. The same workflow closes the
GitOps loop end to end: after a build is pushed and signed, its
`update-gitops-manifests` job commits the new image digest into
`helm/customer-api/values.yaml`/`values-kind.yaml` on `main`, which is the
change ArgoCD's `automated`/`selfHeal` sync actually reacts to - no manual
tag bumping. Two environments are covered:

- **AKS** (`terraform/`, `argocd/`, `helm/customer-api/values.yaml`) - the real
  cloud deployment. Azure CNI network policy, Azure AD RBAC, workload-identity
  federated External Secrets against Key Vault, cert-manager against
  Let's Encrypt.
- **kind** (`terraform/kind/`, `argocd/kind/`, `helm/customer-api/values-kind.yaml`) -
  a local mirror of the same architecture, runnable on your own machine. Same
  chart, same ArgoCD app-of-apps pattern, same NetworkPolicy/ingress/
  cert-manager/External-Secrets shape - just Calico instead of Azure CNI,
  ingress-nginx's hostPort instead of a cloud load balancer, a self-signed
  ClusterIssuer instead of Let's Encrypt, and ESO's own `fake` provider
  instead of Key Vault.

This README covers running the **kind** setup end to end.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or another
  Docker Engine) - **running**, with at least 6 CPUs / 10-12GB RAM allocated if
  you plan to also run the observability stack (see "Optional: also deploy
  monitoring" below). Without it, ~3-4GB is enough for the app alone.
- [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation)
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.9
- `kubectl`
- (optional, only to run `helm template`/`helm lint` yourself) `helm`

## 1. Stand up the platform

Terraform owns everything infrastructure-level: the kind cluster, Calico (so
NetworkPolicy is actually enforced), metrics-server, ingress-nginx,
cert-manager + a local self-signed ClusterIssuer, External Secrets Operator,
the Prometheus Operator CRDs, and ArgoCD itself. It does **not** deploy the
application - that's the next step.

```bash
cd terraform/kind
terraform init
terraform apply
```

This takes a few minutes (pulling several Helm charts). When it finishes, the
`next_steps` output repeats the commands below.

## 2. Deploy the application

This is the one manual step, deliberately - it mirrors exactly how the AKS
side works (`argocd-root-app.yaml` is "the one manifest you apply by hand,
ever" there too). ArgoCD takes over from here, syncing from this repo's `main`
branch on its own.

From the repo root (`cd ../..` if you're still inside `terraform/kind`):

```bash
export KUBECONFIG=terraform/kind/.kubeconfig

# App only:
kubectl apply -f argocd-root-app-kind.yaml

# App + observability stack (Prometheus, Loki, Tempo, Grafana, Alloy):
kubectl apply -f argocd-root-app-kind.yaml -f argocd/monitoring-apps.yaml
```

Watch it sync:

```bash
kubectl get applications -n argocd -w
```

customer-api should reach `Synced`/`Healthy` within a minute or two. If you
applied the monitoring stack too, give it a bit longer - `prometheus`,
`loki`, `tempo`, `grafana`, and `alloy` each sync independently.

## 3. Reach the app

```
https://customer-api.127.0.0.1.nip.io
```

(`nip.io` resolves that hostname to `127.0.0.1` via public DNS, so this works
with no `/etc/hosts` editing - it just needs to resolve, your traffic never
leaves your machine.) Your browser will warn about the certificate - it's
issued by the local self-signed ClusterIssuer, not a real CA, since there's no
public domain for Let's Encrypt to validate against locally. Accept it to
proceed. Try:

```bash
curl -k https://customer-api.127.0.0.1.nip.io/health
curl -k https://customer-api.127.0.0.1.nip.io/api/products
```

## 4. Reach ArgoCD, Grafana, and Prometheus

None of these have a local Ingress (deliberately - `argocd/monitoring/*.yaml`
is shared verbatim with the AKS deployment, so it isn't kind-specific). Reach
them the same way you'd reach any internal-only service: `kubectl
port-forward`.

```bash
# ArgoCD UI - https://localhost:8080, user "admin"
kubectl port-forward -n argocd svc/argocd-server 8080:443
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d

# Grafana - http://localhost:3000 (anonymous admin access, same as docker-compose)
kubectl port-forward -n monitoring svc/grafana 3000:80

# Prometheus - http://localhost:9090
kubectl port-forward -n monitoring svc/prometheus-prometheus 9090:9090
```

Grafana already has Prometheus/Loki/Tempo wired up as datasources (see
`argocd/monitoring/grafana.yaml`), including trace-to-logs and
exemplar-to-trace links - metrics, logs, and traces for customer-api are all
one click apart from each other.

## Tearing down

```bash
cd terraform/kind
terraform destroy
```

This deletes the kind cluster (and everything in it) along with the local
`.kubeconfig` file it wrote.

## Known trade-offs of the local mirror

- **GitOps needs git**: ArgoCD syncs from your real GitHub repo, not your
  working tree. A local edit needs a commit + push to `main` before it shows
  up in-cluster - same as it would on AKS.
- **Resource footprint**: the full stack (platform + app + monitoring) wants
  roughly 6+ CPUs and 10-12GB RAM given to Docker Desktop. Skip the
  `argocd/monitoring-apps.yaml` apply in step 2, or set `worker_count = 0` in
  `terraform/kind` (see `terraform.tfvars.example`), if your machine is
  tighter than that.
