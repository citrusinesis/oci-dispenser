import * as pulumi from "@pulumi/pulumi";

// Use project-level config (no namespace conflicts with providers)
const config = new pulumi.Config();
const tailscaleConfig = new pulumi.Config("tailscale");

export const compartmentId = config.require("compartmentId");
export const region = config.require("region");
export const sshPublicKey = config.require("sshPublicKey");
export const allowPublicAccess = config.getBoolean("allowPublicAccess") ?? true;
export const domainName = config.get("domainName") || "internal.citrus.name";

// Tailscale auth key for host-level installation (SSH rescue)
export const tailscaleAuthKey = tailscaleConfig.requireSecret("hostAuthKey");
