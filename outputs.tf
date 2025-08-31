# Output value definitions

output "instance_id" {
  description = "OCID of the compute instance"
  value       = module.compute.instance_id
}

output "instance_public_ip" {
  description = "Public IP address of the compute instance"
  value       = module.compute.instance_public_ip
}

output "instance_private_ip" {
  description = "Private IP address of the compute instance"
  value       = module.compute.instance_private_ip
}