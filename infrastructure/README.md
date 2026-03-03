# Cloud-Agnostic Kubernetes Infrastructure

This directory contains infrastructure-as-code for deploying Sidney to Kubernetes on AWS, GCP, Azure, or local environments.

## Directory Structure

```
infrastructure/
├── terraform/              # Terraform modules for cloud provisioning
│   ├── modules/
│   │   ├── aws/eks/       # AWS EKS module
│   │   ├── gcp/gke/       # GCP GKE module
│   │   └── azure/aks/     # Azure AKS module
│   ├── variables.tf       # Common variables
│   └── outputs.tf         # Common outputs
├── kubernetes/            # Kubernetes manifests
│   ├── ingress/          # Nginx Ingress, cert-manager
│   ├── secrets/          # External Secrets Operator
│   ├── database/         # Database configurations
│   ├── monitoring/       # Prometheus, Grafana, Loki
│   └── argocd/           # ArgoCD GitOps
├── DEPLOYMENT.md          # Deployment guide
└── RUNBOOK.md            # Operations runbook

apps/
├── base/                  # Cloud-agnostic base manifests
│   ├── backend/          # Backend deployment
│   ├── frontend/         # Frontend deployment
│   ├── ingress/         # Ingress configuration
│   └── storage/          # Storage classes
└── overlays/             # Cloud-specific overlays
    ├── gcp/              # GCP-specific configs
    ├── aws/              # AWS-specific configs
    └── azure/            # Azure-specific configs
```

## Quick Start

1. **Provision Infrastructure:**
   ```bash
   cd infrastructure/terraform/modules/gcp/gke
   terraform init
   terraform apply
   ```

2. **Configure kubectl:**
   ```bash
   gcloud container clusters get-credentials sidney-cluster --region us-central1
   ```

3. **Install Infrastructure Components:**
   ```bash
   # See DEPLOYMENT.md for detailed steps
   ```

4. **Deploy Application:**
   ```bash
   kubectl apply -k apps/overlays/gcp
   ```

### Deploy backend and frontend as separate services

From the **repository root**:

**Backend only:**
```bash
# Ensure namespace and backend secrets/config exist, then:
kubectl apply -k apps/overlays/backend-only
```

**Frontend only:**
```bash
kubectl apply -k apps/overlays/frontend-only
```

**With a specific cloud overlay (image tags, storage, etc.):** use the full overlay for that cloud, then scale the other service to zero if you want only one running:
```bash
kubectl apply -k apps/overlays/gcp
kubectl scale deployment frontend --replicas=0 -n sidney   # run backend only
# or
kubectl scale deployment backend --replicas=0 -n sidney    # run frontend only
```

Backend requires the `backend-secrets` Secret and `backend-config` ConfigMap in the `sidney` namespace; create them or use External Secrets before deploying backend-only.

## Design Principles

### Cloud-Agnostic Architecture

- **Terraform modules** abstract cloud-specific resources
- **Kustomize overlays** handle cloud-specific configurations
- **External Secrets Operator** abstracts secret management
- **Unified storage interface** via StorageClass abstraction
- **Cloud-agnostic monitoring** (Prometheus, Grafana, Loki)

### Best Practices

- Infrastructure as Code (Terraform)
- GitOps (ArgoCD)
- Secrets management (External Secrets Operator)
- Monitoring and observability
- High availability (multi-replica deployments)
- Auto-scaling (HPA + Cluster Autoscaler)
- Security (RBAC, network policies, private clusters)

## Features

- ✅ Multi-cloud support (AWS, GCP, Azure)
- ✅ Automated provisioning (Terraform)
- ✅ GitOps deployment (ArgoCD)
- ✅ Secret management (External Secrets Operator)
- ✅ TLS certificates (cert-manager)
- ✅ Monitoring (Prometheus, Grafana)
- ✅ Logging (Loki)
- ✅ Database options (StatefulSet or managed)
- ✅ CI/CD integration (GitHub Actions)

## Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [RUNBOOK.md](./RUNBOOK.md) - Operations and troubleshooting guide

## Migration Between Clouds

The infrastructure is designed for easy migration:

1. Provision new cluster using Terraform
2. Update image references in overlay
3. Update SecretStore configuration
4. Deploy application
5. Migrate data
6. Update DNS

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed migration steps.

## Cost Optimization

- Node autoscaling configured
- Resource requests/limits set appropriately
- Use managed services for production
- Spot/preemptible instances for non-production

## Security

- Private clusters supported
- Workload Identity / IRSA / Managed Identity
- Network policies
- RBAC enabled
- Secrets management
- TLS everywhere

## Support

For issues or questions:
1. Check [RUNBOOK.md](./RUNBOOK.md) for common operations
2. Review [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment issues
3. Check application logs: `kubectl logs -f deployment/backend -n sidney`
