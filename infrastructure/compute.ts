import * as fs from "node:fs";
import * as path from "node:path";
import * as oci from "@pulumi/oci";
import * as pulumi from "@pulumi/pulumi";
import { compartmentId, sshPublicKey, tailscaleAuthKey } from "./config";
import { subnet } from "./vcn";

const availabilityDomains = oci.identity.getAvailabilityDomainsOutput({
  compartmentId: compartmentId,
});

const ubuntuImage = oci.core.getImagesOutput({
  compartmentId: compartmentId,
  operatingSystem: "Canonical Ubuntu",
  operatingSystemVersion: "24.04",
  shape: "VM.Standard.A1.Flex",
  sortBy: "TIMECREATED",
  sortOrder: "DESC",
});

const instance = new oci.core.Instance("oci-dispenser-server", {
  compartmentId: compartmentId,
  availabilityDomain: availabilityDomains.availabilityDomains.apply((ads) => {
    if (!ads[0]?.name) {
      throw new Error("No availability domain found in compartment");
    }
    return ads[0].name;
  }),
  shape: "VM.Standard.A1.Flex",
  displayName: "oci-dispenser-server",
  shapeConfig: {
    ocpus: 4,
    memoryInGbs: 24,
  },
  sourceDetails: {
    sourceType: "image",
    sourceId: ubuntuImage.images.apply((images) => {
      if (!images[0]?.id) {
        throw new Error("Ubuntu 24.04 ARM64 image not found in compartment");
      }
      return images[0].id;
    }),
    bootVolumeSizeInGbs: "150",
  },
  createVnicDetails: {
    subnetId: subnet.id,
    assignPublicIp: "true",
  },
  metadata: {
    ssh_authorized_keys: sshPublicKey,
    user_data: pulumi.all([tailscaleAuthKey]).apply(([authKey]) => {
      const scriptPath = path.join(__dirname, "cloud-init.sh");
      const script = fs.readFileSync(scriptPath, "utf8");
      return Buffer.from(script.replace("${TAILSCALE_AUTH_KEY}", authKey || "")).toString("base64");
    }),
  },
});

export const publicIp = instance.publicIp;
