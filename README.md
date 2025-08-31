# OCI Dispenser

A Terraform module for deploying Oracle Cloud Infrastructure (OCI) compute instances using the Always Free tier, specifically optimized for ARM-based Ampere instances.

## Overview

This project provides a complete infrastructure-as-code solution for provisioning OCI compute instances with networking, security groups, and all necessary cloud infrastructure components. It's designed to work within OCI's Always Free tier limits while providing a production-ready foundation.

## Features

- **ARM Ampere Compute Instance**: VM.Standard.A1.Flex shape optimized for the Always Free tier
- **Complete Networking Setup**: VCN, subnet, internet gateway, route tables, and security lists
- **Ubuntu 24.04 ARM64**: Latest LTS Ubuntu image for ARM architecture
- **Flexible Configuration**: Configurable CPU, memory, and storage within Always Free limits
- **Security Best Practices**: SSH-only access with customizable security rules
- **Nix Development Environment**: Pre-configured development shell with all necessary tools

## Prerequisites

- OCI account with API key configured
- Terraform >= 1.0
- SSH key pair for instance access

## Quick Start

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd oci-dispenser
   ```

2. **Set up your OCI credentials**:
   - Copy `terraform.tfvars.example` to `terraform.tfvars`
   - Update with your OCI credentials and configuration

3. **Initialize and apply**:
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

## Configuration

### Required Variables

Copy `terraform.tfvars.example` to `terraform.tfvars` and configure:

```hcl
# OCI Authentication
tenancy_ocid     = "ocid1.tenancy.oc1..your-tenancy-ocid"
user_ocid        = "ocid1.user.oc1..your-user-ocid"
fingerprint      = "your-api-key-fingerprint"
private_key_path = "/path/to/your/private/key.pem"
region           = "your-preferred-region"
compartment_ocid = "ocid1.compartment.oc1..your-compartment-ocid"

# Instance Configuration
instance_name       = "your-instance-name"
instance_ocpus      = 4    # Max 4 for Always Free
instance_memory_gb  = 24   # Max 24GB for Always Free
boot_volume_size_gb = 200  # Max 200GB for Always Free

# SSH Access
ssh_public_key = "your-ssh-public-key-content"
```

### Always Free Tier Limits

This configuration respects OCI Always Free tier limits:
- **CPU**: Up to 4 OCPU Ampere cores
- **Memory**: Up to 24GB RAM
- **Storage**: Up to 200GB boot volume
- **Networking**: 1 VCN, 2 subnets, 1 load balancer

## Development Environment

This project includes a Nix flake for a consistent development environment:

```bash
# Enter development shell
nix develop

# Available tools include:
# - terraform, terraform-ls, terraform-docs
# - terragrunt, tflint, tfsec
# - awscli2, jq, yq, curl
```

## Project Structure

```
.
├── main.tf                    # Main Terraform configuration
├── variables.tf              # Input variable definitions
├── outputs.tf               # Output value definitions
├── terraform.tfvars.example # Example configuration
├── flake.nix               # Nix development environment
└── modules/
    └── compute/
        ├── compute.tf      # Compute instance configuration
        ├── network.tf      # VCN and networking components
        ├── data.tf         # Data source queries
        ├── variables.tf    # Module variables
        ├── outputs.tf      # Module outputs
        └── versions.tf     # Provider version constraints
```

## Outputs

After deployment, the following information will be available:

- `instance_id`: OCID of the created compute instance
- `instance_public_ip`: Public IP address for SSH access
- `instance_private_ip`: Private IP within the VCN

## Security Considerations

- The security list allows SSH (port 22) from any IP (0.0.0.0/0)
- Consider restricting SSH access to your specific IP ranges
- All outbound traffic is allowed by default
- SSH key authentication is required for instance access

## Customization

To modify networking or security settings, edit the files in `modules/compute/`:
- `network.tf`: VCN, subnets, gateways, and routing
- `compute.tf`: Instance configuration and metadata

## Cleanup

To destroy all created resources:

```bash
terraform destroy
```
