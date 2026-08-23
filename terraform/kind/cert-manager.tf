# cert-manager: same role it plays via helm/customer-api's
# `cert-manager.io/cluster-issuer` Ingress annotation on AKS. The
# ClusterIssuer it satisfies there (letsencrypt-prod) needs a public ACME
# HTTP-01/DNS-01 challenge this machine can't complete for itself, so the
# local equivalent (selfsigned-cluster-issuer, below) skips ACME entirely -
# same annotation-driven cert-issuance mechanism, browsers just won't trust
# the result without manually accepting it once.
resource "helm_release" "cert_manager" {
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  version          = "v1.16.2"
  namespace        = "cert-manager"
  create_namespace = true
  wait             = true
  # Default (300s) isn't enough on a slow connection pulling 3 images
  # (controller/webhook/cainjector) for the first time - cert-manager has
  # already been observed converging to fully Running only for Helm's own
  # wait to have given up moments earlier and marked the release failed.
  timeout = 900

  values = [
    yamlencode({
      crds = {
        enabled = true
      }
    })
  ]

  depends_on = [time_sleep.wait_for_calico]
}

# cert-manager's admission webhook needs a beat to actually start serving
# after its Deployment reports Ready - creating a ClusterIssuer immediately
# after `helm_release.cert_manager` routinely hits it mid-startup and fails
# validation. A fixed sleep is crude but avoids depending on the webhook's
# own readiness semantics, which the chart doesn't expose to Terraform.
resource "time_sleep" "wait_for_cert_manager_webhook" {
  create_duration = "30s"
  depends_on      = [helm_release.cert_manager]
}

resource "kubectl_manifest" "selfsigned_cluster_issuer" {
  yaml_body = yamlencode({
    apiVersion = "cert-manager.io/v1"
    kind       = "ClusterIssuer"
    metadata = {
      name = "selfsigned-cluster-issuer"
    }
    spec = {
      selfSigned = {}
    }
  })

  depends_on = [time_sleep.wait_for_cert_manager_webhook]
}
