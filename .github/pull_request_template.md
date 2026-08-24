## Summary

<!-- What does this PR do, and why? -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Infrastructure / CI change (terraform, helm, argocd, .github/workflows)
- [ ] Documentation

## Related issue

<!-- Link the issue/ticket this addresses, if any -->

## How was this tested?

<!-- Commands run, environment used (kind/AKS), test output -->

## Checklist

- [ ] `application-CI` / `iac-CI` pass (lint, tests, Semgrep, Trivy, Checkov)
- [ ] No secrets or credentials committed
- [ ] If `helm/` changed: chart version bumped in `Chart.yaml`, or left for `helm-publish`'s auto-bump
- [ ] If `terraform/` changed: `terraform fmt` / `terraform validate` run locally
- [ ] Docs (`README.md`) updated if behavior, setup, or deployment steps changed

## Deployment / rollback notes

<!-- Anything the deployer/reviewer should know before this reaches k8s-release -->
