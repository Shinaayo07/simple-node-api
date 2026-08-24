resource "helm_release" "external_secrets" {
  name             = "external-secrets"
  repository       = "https://external-secrets.io"
  chart            = "external-secrets"
  version          = "0.10.4"
  namespace        = "external-secrets"
  create_namespace = true
  timeout          = 900

  values = [
    yamlencode({
      installCRDs = true
    })
  ]

  depends_on = [time_sleep.wait_for_calico]
}
