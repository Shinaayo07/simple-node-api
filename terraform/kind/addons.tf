resource "helm_release" "metrics_server" {
  name             = "metrics-server"
  repository       = "https://kubernetes-sigs.github.io/metrics-server/"
  chart            = "metrics-server"
  version          = "3.12.2"
  namespace        = "kube-system"
  create_namespace = false
  timeout          = 900

  values = [
    yamlencode({
      args = ["--kubelet-insecure-tls"]
    })
  ]

  depends_on = [time_sleep.wait_for_calico]
}

resource "helm_release" "ingress_nginx" {
  name             = "ingress-nginx"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  version          = "4.11.3"
  namespace        = "ingress-nginx"
  create_namespace = true
  timeout          = 900

  values = [
    yamlencode({
      controller = {
        hostPort = {
          enabled = true
        }
        terminationGracePeriodSeconds = 0
        service = {
          type = "NodePort"
        }
        publishService = {
          enabled = false
        }
        nodeSelector = {
          "ingress-ready" = "true"
        }
        tolerations = [
          {
            key      = "node-role.kubernetes.io/control-plane"
            operator = "Equal"
            effect   = "NoSchedule"
          }
        ]
        extraArgs = {
          "publish-status-address" = "localhost"
        }
      }
    })
  ]

  depends_on = [time_sleep.wait_for_calico]
}
