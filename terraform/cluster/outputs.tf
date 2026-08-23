output "cluster_name" {
  value = azurerm_kubernetes_cluster.this.name
}

output "resource_group_name" {
  value = azurerm_resource_group.aks.name
}

output "oidc_issuer_url" {
  description = "Needed for the future ESO Workload Identity Federation migration (az identity federated-credential create --issuer ...)."
  value       = azurerm_kubernetes_cluster.this.oidc_issuer_url
}

output "kube_config_command" {
  description = "Run this to fetch credentials - uses Azure AD auth, not a static kubeconfig secret."
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.aks.name} --name ${azurerm_kubernetes_cluster.this.name} --overwrite-existing"
}
