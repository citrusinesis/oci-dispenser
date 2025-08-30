# Output value definitions

output "instance_id" {
  description = "OCID of the compute instance"
  value       = oci_core_instance.ampere_instance.id
}

output "instance_public_ip" {
  description = "Public IP address of the compute instance"
  value       = oci_core_instance.ampere_instance.public_ip
}

output "instance_private_ip" {
  description = "Private IP address of the compute instance"
  value       = oci_core_instance.ampere_instance.private_ip
}

output "ssh_connection" {
  description = "SSH connection command"
  value       = "ssh ubuntu@${oci_core_instance.ampere_instance.public_ip}"
}

output "instance_shape" {
  description = "Shape of the compute instance"
  value       = oci_core_instance.ampere_instance.shape
}

output "instance_ocpus" {
  description = "Number of OCPUs allocated to the instance"
  value       = oci_core_instance.ampere_instance.shape_config[0].ocpus
}

output "instance_memory_gb" {
  description = "Amount of memory allocated to the instance in GB"
  value       = oci_core_instance.ampere_instance.shape_config[0].memory_in_gbs
}

output "boot_volume_size_gb" {
  description = "Boot volume size in GB"
  value       = oci_core_instance.ampere_instance.source_details[0].boot_volume_size_in_gbs
}