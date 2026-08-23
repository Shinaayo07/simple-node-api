terraform {
  required_version = ">= 1.9.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  backend "azurerm" {
    # Values filled in via `terraform init -backend-config=backend.hcl`
    # (kept out of version control - see backend.hcl.example) rather than
    # hardcoded here, so the same config can point at different state files
    # per environment without editing source. Values come from
    # bootstrap's `backend_config_snippet` output.
  }
}

provider "azurerm" {
  features {}
}
