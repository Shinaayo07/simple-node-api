# Both providers point at a static local path (see locals.tf), not at
# kind_cluster.this's own kubeconfig attribute - that would make the
# provider config depend on a resource, which Terraform can't evaluate at
# plan time. Every resource that actually talks to the cluster still
# carries an explicit depends_on = [kind_cluster.this], so apply-time
# ordering is correct even though the provider blocks themselves have no
# resource dependency.
provider "helm" {
  kubernetes {
    config_path = local.kubeconfig_path
  }
}

provider "kubectl" {
  config_path      = local.kubeconfig_path
  load_config_file = true
}
