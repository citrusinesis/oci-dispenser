# Input variable definitions

variable "compartment_ocid" {
  description = "OCID of the compartment where resources will be created"
  type        = string
}

variable "tenancy_ocid" {
  description = "OCID of your tenancy"
  type        = string
}

# Instance Configuration Variables
variable "instance_name" {
  description = "Display name for the compute instance"
  type        = string
  default     = "ampere-instance"
}

variable "instance_ocpus" {
  description = "Number of OCPUs for the instance (Always Free allows up to 4)"
  type        = number
  default     = 4
  
  validation {
    condition     = var.instance_ocpus >= 1 && var.instance_ocpus <= 4
    error_message = "OCPUs must be between 1 and 4 for Always Free tier."
  }
}

variable "instance_memory_gb" {
  description = "Amount of memory in GBs (Always Free allows up to 24GB)"
  type        = number
  default     = 24
  
  validation {
    condition     = var.instance_memory_gb >= 1 && var.instance_memory_gb <= 24
    error_message = "Memory must be between 1 and 24 GB for Always Free tier."
  }
}

variable "boot_volume_size_gb" {
  description = "Boot volume size in GBs (Always Free allows up to 200GB)"
  type        = number
  default     = 200
  
  validation {
    condition     = var.boot_volume_size_gb >= 50 && var.boot_volume_size_gb <= 200
    error_message = "Boot volume size must be between 50 and 200 GB for Always Free tier."
  }
}

variable "ssh_public_key" {
  description = "SSH public key for connecting to the instance"
  type        = string
}

