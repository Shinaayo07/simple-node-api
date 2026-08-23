output "kubeconfig_path" {
  description = "Local kubeconfig for this cluster. export KUBECONFIG to this path, or pass it via --kubeconfig."
  value       = local.kubeconfig_path
}

output "next_steps" {
  description = "What to run after `terraform apply` finishes - Terraform's job ends at the platform layer; ArgoCD takes it from here."
  value       = <<-EOT
    Cluster and platform components are up. To deploy the application:

      export KUBECONFIG=${local.kubeconfig_path}

      # App only:
      kubectl apply -f ../../argocd-root-app-kind.yaml

      # App + observability stack (Prometheus/Loki/Tempo/Grafana/Alloy):
      kubectl apply -f ../../argocd-root-app-kind.yaml -f ../../argocd/monitoring-apps.yaml

    ArgoCD then syncs from git on its own. See the repo README for how to
    watch that sync, reach the app, and reach Grafana/ArgoCD locally.
  EOT
}
