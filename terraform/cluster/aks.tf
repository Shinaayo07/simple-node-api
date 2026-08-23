data "azurerm_client_config" "current" {}

resource "azurerm_kubernetes_cluster" "this" {
  name                = var.cluster_name
  resource_group_name = azurerm_resource_group.aks.name
  location            = azurerm_resource_group.aks.location
  dns_prefix          = var.cluster_name
  kubernetes_version  = var.kubernetes_version
  sku_tier            = var.sku_tier
  tags                = var.tags

  # Managed identity, not a service-principal-with-secret, for the
  # cluster's own control-plane identity.
  identity {
    type = "SystemAssigned"
  }

  default_node_pool {
    name                 = "system"
    vm_size              = var.node_vm_size
    vnet_subnet_id       = azurerm_subnet.nodes.id
    auto_scaling_enabled = true
    min_count            = var.node_min_count
    max_count            = var.node_max_count
    os_disk_size_gb      = 30
    tags                 = var.tags
  }

  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay" # pods get overlay IPs, not real VNet IPs - avoids burning subnet address space
    network_policy      = "azure"   # required for customer-api's NetworkPolicy resources to actually be enforced
    load_balancer_sku   = "standard"
  }

  # Real Azure AD identities/role assignments control cluster access -
  # no shared static kubeconfig admin credential.
  azure_active_directory_role_based_access_control {
    azure_rbac_enabled = true
    tenant_id          = data.azurerm_client_config.current.tenant_id
  }
  role_based_access_control_enabled = true
  local_account_disabled            = true

  # Public API server, but restricted to specific IPs - most of a private
  # cluster's security benefit without needing a bastion/VPN just to run
  # kubectl. See variables.tf for why this can't be left empty.
  api_server_access_profile {
    authorized_ip_ranges = var.authorized_ip_ranges
  }

  # Enabled from day one even though ESO currently uses a Service Principal,
  # not Workload Identity - costs nothing extra now, and is the prerequisite
  # for migrating ESO off the SP later without re-provisioning the cluster.
  oidc_issuer_enabled       = true
  workload_identity_enabled = true

  lifecycle {
    ignore_changes = [
      kubernetes_version, # let AKS's own auto-upgrade channel (if enabled later) manage this without fighting Terraform
    ]
  }
}
