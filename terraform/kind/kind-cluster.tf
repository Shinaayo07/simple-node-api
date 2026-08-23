# One control-plane + var.worker_count workers. disable_default_cni is the
# load-bearing setting here: kind normally installs kindnet, which routes
# pod traffic but enforces zero NetworkPolicy - every NetworkPolicy the
# customer-api chart ships (default-deny-all, allow-ingress-from-nginx,
# allow-egress-dns, allow-egress-to-tempo) would silently do nothing on
# top of it. Calico goes in instead, in networking.tf, right after this.
resource "kind_cluster" "this" {
  name            = var.cluster_name
  node_image      = var.node_image
  wait_for_ready  = true
  kubeconfig_path = local.kubeconfig_path

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    networking {
      disable_default_cni = true
      pod_subnet          = var.pod_subnet
      service_subnet      = var.service_subnet
    }

    node {
      role = "control-plane"

      # kind's node config has no first-class "labels" field - a
      # kubeadm InitConfiguration patch setting kubeletExtraArgs is the
      # documented way to label a node at join time. ingress-ready=true is
      # what ingress-nginx's nodeSelector (addons.tf) schedules onto, and
      # the matching toleration lets it sit on the control-plane node
      # despite the default NoSchedule taint - the same trade its real AKS
      # nodes never have to make, since there ingress-nginx just gets its
      # own worker-pool capacity.
      kubeadm_config_patches = [
        "kind: InitConfiguration\nnodeRegistration:\n  kubeletExtraArgs:\n    node-labels: \"ingress-ready=true\"\n"
      ]

      extra_port_mappings {
        container_port = 80
        host_port      = var.http_host_port
        protocol       = "TCP"
      }
      extra_port_mappings {
        container_port = 443
        host_port      = var.https_host_port
        protocol       = "TCP"
      }
    }

    dynamic "node" {
      for_each = range(var.worker_count)
      content {
        role = "worker"
      }
    }
  }
}
