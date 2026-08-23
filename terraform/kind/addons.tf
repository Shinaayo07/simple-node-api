# metrics-server: AKS ships this as a built-in cluster addon; kind has
# nothing equivalent, and customer-api's HorizontalPodAutoscaler (CPU +
# memory utilization targets) has no metrics API to read from without it.
resource "helm_release" "metrics_server" {
  name             = "metrics-server"
  repository       = "https://kubernetes-sigs.github.io/metrics-server/"
  chart            = "metrics-server"
  version          = "3.12.2"
  namespace        = "kube-system"
  create_namespace = false

  values = [
    yamlencode({
      # kind's kubelets serve a self-signed cert with no SAN matching how
      # metrics-server reaches them - the same node-cert trust problem
      # every local/self-hosted kind cluster runs into. AKS's kubelets are
      # provisioned with certs the API server already trusts, so this flag
      # doesn't exist in aks.tf at all.
      args = ["--kubelet-insecure-tls"]
    })
  ]

  depends_on = [time_sleep.wait_for_calico]
}

# ingress-nginx: same ingress class ("nginx") customer-api's values.yaml
# already targets on AKS. The values below are the standard kind adaptation
# (https://kind.sigs.k8s.io/docs/user/ingress/) - hostPort instead of a
# cloud LoadBalancer (kind has none to hand out), scheduled onto the
# control-plane node via the ingress-ready label set in kind-cluster.tf.
resource "helm_release" "ingress_nginx" {
  name             = "ingress-nginx"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  version          = "4.11.3"
  namespace        = "ingress-nginx"
  create_namespace = true

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
