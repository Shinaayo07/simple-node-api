data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "tfstate" {
  name     = var.state_resource_group_name
  location = var.location
}

resource "azurerm_storage_account" "tfstate" { # nosemgrep: terraform.azure.security.storage.storage-queue-services-logging.storage-queue-services-logging
  name                = var.state_storage_account_name
  resource_group_name = azurerm_resource_group.tfstate.name
  location            = azurerm_resource_group.tfstate.location

  account_tier             = "Standard"
  account_replication_type = "LRS"

  min_tls_version                  = "TLS1_2"
  allow_nested_items_to_be_public  = false
  shared_access_key_enabled        = false
  cross_tenant_replication_enabled = false

  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 7
    }
    container_delete_retention_policy {
      days = 7
    }
  }

  dynamic "network_rules" {
    for_each = length(var.allowed_ip_ranges) > 0 ? [1] : []
    content {
      default_action = "Deny"
      ip_rules       = var.allowed_ip_ranges
      bypass         = ["AzureServices"]
    }
  }
}

resource "azurerm_storage_container" "tfstate" {
  name                  = var.state_container_name
  storage_account_id    = azurerm_storage_account.tfstate.id
  container_access_type = "private"
}

resource "azurerm_role_assignment" "tfstate_contributor" {
  scope                = azurerm_storage_account.tfstate.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}
