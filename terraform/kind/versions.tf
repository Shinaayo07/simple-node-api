terraform {
  required_version = ">= 1.9.0"

  required_providers {
    kind = {
      source  = "tehcyx/kind"
      version = "~> 0.7"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.16"
    }
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "~> 1.14"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.12"
    }
  }

  # No remote backend, deliberately - unlike terraform/cluster's Azure
  # storage backend. This state describes a cluster that only exists on
  # the machine that created it; there's nothing to share it with, and
  # `terraform destroy` here is a normal, frequent operation (not the rare,
  # careful one it is for AKS).
}
