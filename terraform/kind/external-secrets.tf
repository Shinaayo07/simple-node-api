# External Secrets Operator: the controller behind every SecretStore/
# ExternalSecret the customer-api chart renders. Same operator as AKS -
# only the SecretStore's provider differs (fake here vs azurekv there, see
# helm/customer-api/values-kind.yaml), so this is genuinely the same
# secret-management path being exercised, not a stand-in for it.
resource "helm_release" "external_secrets" {
  name             = "external-secrets"
  repository       = "https://charts.external-secrets.io"
  chart            = "external-secrets"
  version          = "0.10.4"
  namespace        = "external-secrets"
  create_namespace = true

  values = [
    yamlencode({
      installCRDs = true
    })
  ]

  depends_on = [time_sleep.wait_for_calico]
}
