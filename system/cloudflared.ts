import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import { provider } from "./k3s";

const config = new pulumi.Config("cloudflare");
const tunnelToken = config.requireSecret("tunnelToken");

const ns = new k8s.core.v1.Namespace(
  "cloudflared-system",
  {
    metadata: { name: "cloudflared" },
  },
  { provider },
);

const secret = new k8s.core.v1.Secret(
  "cloudflared-token",
  {
    metadata: {
      name: "cloudflared-token",
      namespace: ns.metadata.name,
    },
    stringData: {
      TUNNEL_TOKEN: tunnelToken,
    },
  },
  { provider, dependsOn: [ns] },
);

export const deployment = new k8s.apps.v1.Deployment(
  "cloudflared",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "cloudflared",
      labels: { app: "cloudflared" },
    },
    spec: {
      replicas: 2,
      selector: { matchLabels: { app: "cloudflared" } },
      template: {
        metadata: { labels: { app: "cloudflared" } },
        spec: {
          containers: [
            {
              name: "cloudflared",
              image: "cloudflare/cloudflared:2025.10.0",
              args: ["tunnel", "--no-autoupdate", "--metrics", "0.0.0.0:2000", "run"],
              env: [
                {
                  name: "TUNNEL_TOKEN",
                  valueFrom: {
                    secretKeyRef: {
                      name: secret.metadata.name,
                      key: "TUNNEL_TOKEN",
                    },
                  },
                },
              ],
              resources: {
                requests: {
                  cpu: "10m",
                  memory: "64Mi",
                },
                limits: {
                  cpu: "100m",
                  memory: "128Mi",
                },
              },
              livenessProbe: {
                httpGet: { path: "/ready", port: 2000 },
                initialDelaySeconds: 10,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: { path: "/ready", port: 2000 },
                initialDelaySeconds: 5,
                periodSeconds: 5,
              },
            },
          ],
        },
      },
    },
  },
  { provider, dependsOn: [ns, secret] },
);
