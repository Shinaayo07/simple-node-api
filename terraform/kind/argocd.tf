# Installs the ArgoCD platform itself and stops there - this module owns
# infrastructure, not application deployments. Once this apply finishes,
# the one manual step is applying argocd-root-app-kind.yaml (and, if you
# want the observability stack, argocd/monitoring-apps.yaml alongside it) -
# see the repo README and this module's outputs.tf.
#
# dex/notifications disabled: no SSO to broker (this cluster has one user:
# you) and no external notification sink configured - pure resource
# trimming for a local demo cluster, same spirit as prometheus.yaml
# disabling node-exporter/kube-state-metrics/alertmanager it doesn't need.
resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = "7.7.11"
  namespace        = "argocd"
  create_namespace = true
  timeout          = 900

  values = [
    yamlencode({
      dex = {
        enabled = false
      }
      notifications = {
        enabled = false
      }
    })
  ]

  depends_on = [time_sleep.wait_for_calico]
}
