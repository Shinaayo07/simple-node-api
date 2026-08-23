locals {
  # A static path, not a computed resource attribute - this is what lets
  # the helm/kubectl provider blocks below reference it directly without
  # Terraform complaining that "provider configuration cannot depend on a
  # resource". kind_cluster.this is told to write its kubeconfig to this
  # same path; Terraform's resource graph (via depends_on on every
  # helm_release/kubectl_manifest below) guarantees the file exists before
  # anything tries to read it.
  kubeconfig_path = "${path.module}/.kubeconfig"
}
