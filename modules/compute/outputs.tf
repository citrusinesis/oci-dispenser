output "instance_id" {
  description = "The OCID of the created instance"
  value       = oci_core_instance.ampere_instance.id
}

output "instance_public_ip" {
  description = "The public IP address of the instance"
  value       = oci_core_instance.ampere_instance.public_ip
}

output "instance_private_ip" {
  description = "The private IP address of the instance"
  value       = oci_core_instance.ampere_instance.private_ip
}