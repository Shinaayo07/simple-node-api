resource "azurerm_resource_group" "aks" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

resource "azurerm_virtual_network" "aks" {
  name                = "vnet-${var.cluster_name}"
  resource_group_name = azurerm_resource_group.aks.name
  location            = azurerm_resource_group.aks.location
  address_space       = var.vnet_address_space
  tags                = var.tags
}

resource "azurerm_subnet" "nodes" {
  name                 = "snet-nodes"
  resource_group_name  = azurerm_resource_group.aks.name
  virtual_network_name = azurerm_virtual_network.aks.name
  address_prefixes     = var.node_subnet_address_prefix
}
