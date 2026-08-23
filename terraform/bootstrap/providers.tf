terraform {
  required_version = ">= 1.9.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  # Deliberately local state for this config only - it creates the storage
  # account that every other Terraform config's remote state lives in, so it
  # can't depend on that storage account existing yet. Run this once, keep
  # terraform.tfstate somewhere safe (it's small and rarely changes again
  # after the first apply).
}

provider "azurerm" {
  features {}
}
