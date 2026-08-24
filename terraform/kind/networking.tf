data "http" "calico_manifest" {
  url = "https://raw.githubusercontent.com/projectcalico/calico/${var.calico_version}/manifests/calico.yaml"
}

data "kubectl_file_documents" "calico" {
  content = data.http.calico_manifest.response_body
}

resource "kubectl_manifest" "calico" {
  for_each  = data.kubectl_file_documents.calico.manifests
  yaml_body = each.value

  depends_on = [kind_cluster.this]
}

resource "time_sleep" "wait_for_calico" {
  create_duration = "30s"
  depends_on      = [kubectl_manifest.calico]
}
