resource "helm_release" "cert_manager" {
  name             = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  version          = "v1.16.2"
  namespace        = "cert-manager"
  create_namespace = true
  wait             = true
  timeout          = 900

  values = [
    yamlencode({
      crds = {
        enabled = true
      }
    })
  ]

  depends_on = [time_sleep.wait_for_calico]
}

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
