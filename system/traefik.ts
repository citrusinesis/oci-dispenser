import * as k8s from "@pulumi/kubernetes";
import { provider } from "./k3s";
import { operator } from "./tailscale";

// k3s comes with Traefik pre-installed in kube-system namespace
// We expose it via Tailscale LoadBalancer for private access

// Traefik Internal Gateway (Tailscale LoadBalancer)
// This exposes Traefik to the Tailnet for HTTPS with Let's Encrypt certs
export const traefikTailscaleService = new k8s.core.v1.Service(
  "traefik-internal-gateway",
  {
    metadata: {
      name: "traefik-internal-gateway",
      namespace: "kube-system",
      annotations: {
        "tailscale.com/expose": "true",
        "tailscale.com/hostname": "internal-gateway",
      },
    },
    spec: {
      type: "LoadBalancer",
      loadBalancerClass: "tailscale",
      selector: {
        "app.kubernetes.io/name": "traefik", // k3s default Traefik labels
      },
      ports: [
        {
          name: "web",
          port: 80,
          targetPort: 8000,
          protocol: "TCP",
        },
        {
          name: "websecure",
          port: 443,
          targetPort: 8443,
          protocol: "TCP",
        },
      ],
    },
  },
  { provider, dependsOn: [operator] },
);

// Note: Cloudflared accesses Traefik via ClusterIP (default service)
// Private apps use this Tailscale LoadBalancer with HTTPS (Let's Encrypt)
