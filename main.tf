# Main Terraform configuration
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
  }
}

# Configure OCI provider
provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# Data source to get the list of availability domains
data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

# Data source to get the latest Ubuntu 24.04 ARM64 image
data "oci_core_images" "ubuntu_24_04_arm" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

# Get the default VCN
data "oci_core_vcns" "existing_vcns" {
  compartment_id = var.compartment_ocid
}

# Get public subnet from the VCN
data "oci_core_subnets" "public_subnets" {
  compartment_id = var.compartment_ocid
  vcn_id         = data.oci_core_vcns.existing_vcns.virtual_networks[0].id
  
  filter {
    name   = "prohibit_public_ip_on_vnic"
    values = [false]
  }
}

# Create compute instance
resource "oci_core_instance" "ampere_instance" {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  compartment_id      = var.compartment_ocid
  display_name        = var.instance_name
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = var.instance_ocpus
    memory_in_gbs = var.instance_memory_gb
  }

  create_vnic_details {
    subnet_id        = data.oci_core_subnets.public_subnets.subnets[0].id
    display_name     = "${var.instance_name}-vnic"
    assign_public_ip = true
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu_24_04_arm.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_size_gb
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
  }

  preserve_boot_volume = false

  freeform_tags = {
    "Environment" = var.environment
    "Project"     = "oci-dispenser"
    "CreatedBy"   = "Terraform"
    "OS"          = "Ubuntu-24.04"
    "Shape"       = "VM.Standard.A1.Flex"
  }
}