variable "location" {
  description = "Azure region for the cluster and its network."
  type        = string
  default     = "westus2"
}

variable "resource_group_name" {
  description = "Resource group for the AKS cluster and its network."
  type        = string
  default     = "rg-simple-node-api-aks"
}

variable "cluster_name" {
  description = "AKS cluster name."
  type        = string
  default     = "aks-simple-node-api"
}

variable "kubernetes_version" {
  description = "Kubernetes version. Left null to track whatever AKS currently defaults new clusters to."
  type        = string
  default     = null
}

variable "vnet_address_space" {
  description = "CIDR for the cluster VNet."
  type        = list(string)
  default     = ["10.10.0.0/16"]
}

variable "node_subnet_address_prefix" {
  description = "CIDR for the node pool subnet, carved out of vnet_address_space."
  type        = list(string)
  default     = ["10.10.1.0/24"]
}

variable "node_vm_size" {
  description = <<-EOT
    Worker VM size. Deliberately NOT a B-series burstable SKU (e.g.
    Standard_B2s) despite it being cheaper - Microsoft advises against
    burstable VMs for AKS system node pools since CPU-credit exhaustion
    under load can starve system pods (CoreDNS, metrics-server).
    Standard_D2as_v5 (2 vCPU/8GiB, AMD-based) is the cheapest SKU that's
    still actually recommended, not just cheap.
  EOT
  type        = string
  default     = "Standard_D2as_v5"
}

variable "node_min_count" {
  description = "Cluster autoscaler floor. 2 so the PodDisruptionBudget/topology spread constraints on customer-api mean something."
  type        = number
  default     = 2
}

variable "node_max_count" {
  description = "Cluster autoscaler ceiling."
  type        = number
  default     = 3
}

variable "sku_tier" {
  description = "AKS control plane pricing tier. Free = no SLA, $0/month control plane cost - appropriate for a non-production cluster."
  type        = string
  default     = "Free"
}

variable "authorized_ip_ranges" {
  description = <<-EOT
    Public IP ranges (CIDR) allowed to reach the API server. Required to be
    non-empty - an AKS cluster with an empty list here is fully open to the
    internet, which this config deliberately refuses to allow (see the
    validation below). Add your own public IP (https://ifconfig.me) as a /32.
  EOT
  type        = list(string)

  validation {
    condition     = length(var.authorized_ip_ranges) > 0
    error_message = "authorized_ip_ranges must not be empty - set it to your own public IP(s) as /32 CIDRs, e.g. [\"203.0.113.4/32\"]."
  }
}

variable "tags" {
  description = "Tags applied to every resource this config creates."
  type        = map(string)
  default = {
    project     = "simple-node-api"
    managed_by  = "terraform"
    environment = "dev"
  }
}
