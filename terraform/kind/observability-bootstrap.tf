# Mirrors the exact bootstrap step documented in
# argocd/monitoring/prometheus.yaml: the Prometheus Operator CRDs are
# installed once, here, outside GitOps - never by the ArgoCD-managed
# kube-prometheus-stack release itself (that release runs with
# helm.skipCrds so it can never prune them). Needed regardless of whether
# you end up applying argocd/monitoring-apps.yaml, since customer-api's own
# ServiceMonitor (serviceMonitor.enabled: true) is a CRD instance of these
# same CRDs.
resource "helm_release" "prometheus_operator_crds" {
  name             = "prometheus-operator-crds"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "prometheus-operator-crds"
  version          = "18.0.1"
  namespace        = "monitoring"
  create_namespace = true

  depends_on = [time_sleep.wait_for_calico]
}
