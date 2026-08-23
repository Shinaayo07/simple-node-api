# Replaces kindnet (disabled in kind-cluster.tf) with Calico, giving kind
# real NetworkPolicy enforcement - the same property terraform/cluster's
# aks.tf gets from `network_plugin_mode = "overlay"` + `network_policy =
# "azure"`. Applied from the upstream manifest (not the tigera-operator
# Helm chart) specifically to avoid having to hand-align an IP pool CIDR
# with pod_subnet above: this manifest's default CALICO_IPV4POOL_CIDR is
# unset, so Calico just uses whatever pod CIDR Kubernetes already assigned
# each node - already var.pod_subnet, nothing further to reconcile.
data "http" "calico_manifest" {
  url = "https://raw.githubusercontent.com/projectcalico/calico/${var.calico_version}/manifests/calico.yaml"
}

data "kubectl_file_documents" "calico" {
  content = data.http.calico_manifest.response_body
}

resource "kubectl_manifest" "calico" {
  for_each  = data.kubectl_file_documents.calico.manifests
  yaml_body = each.value

  depends_on = [kind_cluster.this]
}

# kubectl_manifest only confirms the Calico manifests were applied, not that
# calico-node has actually come up on every node yet. Every other
# helm_release below depends on this instead of on kubectl_manifest.calico
# directly - without it, their pods can get scheduled before there's a CNI
# to hand them an IP, and (since helm_release's default wait: true blocks
# until pods report Ready) that can stall or time out an apply that would
# otherwise converge fine a few seconds later. Same fixed-sleep trade-off as
# cert-manager.tf's webhook wait: crude, but avoids depending on internal
# Calico readiness signals this module has no clean way to observe.
resource "time_sleep" "wait_for_calico" {
  create_duration = "30s"
  depends_on      = [kubectl_manifest.calico]
}
