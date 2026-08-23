data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "tfstate" {
  name     = var.state_resource_group_name
  location = var.location
}

# This account is blob-only - it holds Terraform state and nothing else
# (see azurerm_storage_container.tfstate below). No azurerm_storage_queue is
# ever created against it, so there's no queue traffic for queue-service
# analytics logging to record; enabling it would just be a permanently-empty
# log stream for a data service this account doesn't use.
resource "azurerm_storage_account" "tfstate" { # nosemgrep: terraform.azure.security.storage.storage-queue-services-logging
  name                = var.state_storage_account_name
  resource_group_name = azurerm_resource_group.tfstate.name
  location            = azurerm_resource_group.tfstate.location

  account_tier             = "Standard"
  account_replication_type = "LRS" # cheapest redundancy tier - fine for state, not customer data

  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  # No storage account keys at all - every access (including Terraform's own
  # backend config) goes through Azure AD RBAC on the blob data plane, not a
  # long-lived shared key that could leak.
  shared_access_key_enabled        = false
  cross_tenant_replication_enabled = false

  blob_properties {
    versioning_enabled = true # roll back a corrupted/bad state write

    delete_retention_policy {
      days = 7
    }
    container_delete_retention_policy {
      days = 7
    }
  }

  dynamic "network_rules" {
    # If no IPs are supplied yet, default to open (still Azure-AD-only auth,
    # since keys are disabled above) so initial setup isn't blocked. Set
    # allowed_ip_ranges once you know your real IP(s) to actually restrict
    # network-level reachability, not just data-plane auth.
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

# Grants whoever is running Terraform right now (a human via `az login`, or
# a CI service principal) permission to actually read/write the state blob -
# required since shared_access_key_enabled = false above means the storage
# account key can't be used as a fallback.
resource "azurerm_role_assignment" "tfstate_contributor" {
  scope                = azurerm_storage_account.tfstate.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}
