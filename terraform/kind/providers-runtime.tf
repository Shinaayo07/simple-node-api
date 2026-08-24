provider "helm" {
  kubernetes {
    config_path = local.kubeconfig_path
  }
}

provider "kubectl" {
  config_path      = local.kubeconfig_path
  load_config_file = true
}
