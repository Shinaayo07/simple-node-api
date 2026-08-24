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
