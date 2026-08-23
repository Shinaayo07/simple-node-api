# External Secrets Operator: the controller behind every SecretStore/
# ExternalSecret the customer-api chart renders. Same operator as AKS -
# only the SecretStore's provider differs (fake here vs azurekv there, see
# helm/customer-api/values-kind.yaml), so this is genuinely the same
# secret-management path being exercised, not a stand-in for it.
resource "helm_release" "external_secrets" {
  name = "external-secrets"
  # Not charts.external-secrets.io - that now just 302-redirects here, and
  # the Helm provider doesn't follow it when priming its repo cache, which
  # poisons every other helm_release in the same apply (they all fail citing
  # this repo's missing index, regardless of which chart they actually need).
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
