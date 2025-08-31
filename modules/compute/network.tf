# Create VCN
resource "oci_core_vcn" "main" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.0.0.0/16"]
  display_name   = "${var.instance_name}-vcn"
  dns_label      = "mainvcn"

  freeform_tags = {
    "Project"   = "oci-dispenser"
    "CreatedBy" = "citrusinesis"
  }
}

# Create Internet Gateway
resource "oci_core_internet_gateway" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.instance_name}-igw"
  enabled        = true

  freeform_tags = {
    "Project"   = "oci-dispenser"
    "CreatedBy" = "citrusinesis"
  }
}

# Create Route Table
resource "oci_core_route_table" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.instance_name}-rt"

  route_rules {
    network_entity_id = oci_core_internet_gateway.main.id
    destination       = "0.0.0.0/0"
  }

  freeform_tags = {
    "Project"   = "oci-dispenser"
    "CreatedBy" = "citrusinesis"
  }
}

# Create Security List
resource "oci_core_security_list" "main" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.instance_name}-sl"

  # Allow SSH
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      min = 22
      max = 22
    }
  }

  # Allow all outbound
  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }

  freeform_tags = {
    "Project"   = "oci-dispenser"
    "CreatedBy" = "citrusinesis"
  }
}

# Create Public Subnet
resource "oci_core_subnet" "public" {
  compartment_id      = var.compartment_ocid
  vcn_id              = oci_core_vcn.main.id
  cidr_block          = "10.0.1.0/24"
  display_name        = "${var.instance_name}-public-subnet"
  dns_label           = "public"
  route_table_id      = oci_core_route_table.main.id
  security_list_ids   = [oci_core_security_list.main.id]
  prohibit_public_ip_on_vnic = false

  freeform_tags = {
    "Project"   = "oci-dispenser"
    "CreatedBy" = "citrusinesis"
  }
}