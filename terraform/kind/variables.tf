variable "cluster_name" {
  description = "kind cluster name."
  type        = string
  default     = "simple-node-api-kind"
}

variable "node_image" {
  description = <<-EOT
    kindest/node image (pins the Kubernetes version). Bump this rather than
    relying on whatever kind's own default happens to be, same reasoning as
    terraform/cluster pinning kubernetes_version - reproducibility means the
    version is a decision recorded in code, not whatever was current the day
    someone ran `kind create cluster`.
  EOT
  type        = string
  default     = "kindest/node:v1.31.2"
}

variable "worker_count" {
  description = <<-EOT
    Extra worker nodes beyond the single control-plane node. 2 mirrors
    terraform/cluster's node_min_count, so the PodDisruptionBudget and
    topology spread constraints on customer-api actually mean something.
    Set to 0 for a single-node cluster on a resource-constrained machine -
    everything still schedules and runs, PDB/spread just have nothing to do.
  EOT
  type        = number
  default     = 1
}

variable "http_host_port" {
  description = "Host port mapped to kind's ingress-nginx (HTTP). Change if 80 is already taken locally."
  type        = number
  default     = 80
}

variable "https_host_port" {
  description = "Host port mapped to kind's ingress-nginx (HTTPS). Change if 443 is already taken locally."
  type        = number
  default     = 443
}

variable "calico_version" {
  description = "Calico release tag - pins the manifest URL used to install NetworkPolicy enforcement (kind's default CNI enforces none)."
  type        = string
  default     = "v3.28.0"
}

variable "pod_subnet" {
  description = "Cluster pod CIDR. Matches kind's own default so Calico needs no pool override to line up with it."
  type        = string
  default     = "10.244.0.0/16"
}

variable "service_subnet" {
  description = "Cluster service CIDR. Matches kind's own default."
  type        = string
  default     = "10.96.0.0/12"
}
