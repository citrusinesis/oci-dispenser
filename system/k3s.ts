import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as command from "@pulumi/command";
import { publicIp } from "../infrastructure/compute";

const sshPrivateKey = pulumi.secret(process.env["SSH_PRIVATE_KEY"] || "");

const kubeconfig = new command.remote.Command(
  "get-kubeconfig",
  {
    connection: {
      host: publicIp,
      user: "ubuntu",
      privateKey: sshPrivateKey,
    },
    create: `
      # Wait for cloud-init to complete (redirect echo to stderr)
      echo "Waiting for cloud-init to complete..." >&2
      cloud-init status --wait

      # Wait for k3s.yaml to exist
      echo "Waiting for k3s to be ready..." >&2
      timeout 300 bash -c 'until sudo test -f /etc/rancher/k3s/k3s.yaml; do sleep 2; done'

      # Read kubeconfig with sudo (only this goes to stdout)
      sudo cat /etc/rancher/k3s/k3s.yaml
    `,
  },
  {}
); // Implicit dependency on publicIp via connection

export const k3sConfig = pulumi.secret(
  pulumi
    .all([kubeconfig.stdout, publicIp])
    .apply(([config, ip]: [string, string]) => {
      return config.replace("127.0.0.1", ip).replace("0.0.0.0", ip);
    })
);

export const provider = new k8s.Provider("k3s-provider", {
  kubeconfig: k3sConfig,
});
