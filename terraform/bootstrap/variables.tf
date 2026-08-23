variable "location" {
  description = "Azure region for the Terraform state backend."
  type        = string
  default     = "westus2"
}

variable "state_resource_group_name" {
  description = "Resource group holding the Terraform remote state storage account."
  type        = string
  default     = "rg-simple-node-api-tfstate"
}

variable "state_storage_account_name" {
  description = "Globally-unique storage account name (lowercase, 3-24 chars, no hyphens)."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.state_storage_account_name))
    error_message = "Storage account names must be 3-24 lowercase letters/numbers, no hyphens."
  }
}

variable "state_container_name" {
  description = "Blob container name that will hold the cluster config's .tfstate file."
  type        = string
  default     = "tfstate"
}

variable "allowed_ip_ranges" {
  description = <<-EOT
    Public IP ranges (CIDR) allowed to reach the state storage account's
    public endpoint. Leave empty only for initial setup convenience - lock
    this down to your actual IP(s) once known, since Azure AD auth alone
    doesn't stop network-level access attempts from reaching the endpoint.
  EOT
  type        = list(string)
  default     = []
}
