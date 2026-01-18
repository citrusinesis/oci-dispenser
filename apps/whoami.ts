import * as k8s from "@pulumi/kubernetes";
import { provider } from "../system/k3s";
import { domainName } from "../infrastructure/config";
import { internalWildcardCert } from "../system/cert-manager";

const ns = new k8s.core.v1.Namespace(
  "whoami-system",
  {
    metadata: { name: "whoami" },
  },
  { provider }
);

export const deployment = new k8s.apps.v1.Deployment(
  "whoami",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "whoami",
      labels: { app: "whoami" },
    },
    spec: {
      replicas: 2,
      selector: { matchLabels: { app: "whoami" } },
      template: {
        metadata: { labels: { app: "whoami" } },
        spec: {
          containers: [
            {
              name: "whoami",
              image: "traefik/whoami:v1.11",
              ports: [{ containerPort: 80 }],
              resources: {
                limits: { memory: "128Mi", cpu: "100m" },
                requests: { memory: "64Mi", cpu: "50m" },
              },
              livenessProbe: {
                httpGet: { path: "/", port: 80 },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: { path: "/", port: 80 },
                initialDelaySeconds: 2,
                periodSeconds: 5,
              },
            },
          ],
        },
      },
    },
  },
  { provider, dependsOn: [ns] }
);

export const service = new k8s.core.v1.Service(
  "whoami-service",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "whoami-service",
    },
    spec: {
      selector: { app: "whoami" },
      ports: [{ port: 80, targetPort: 80 }],
      type: "ClusterIP",
    },
  },
  { provider, dependsOn: [ns] }
);

export const privateIngress = new k8s.networking.v1.Ingress(
  "whoami-private-ingress",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "whoami-private",
    },
    spec: {
      ingressClassName: "traefik",
      tls: [
        {
          hosts: [`whoami.${domainName}`],
          secretName: "internal-wildcard-tls",
        },
      ],
      rules: [
        {
          host: `whoami.${domainName}`,
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: service.metadata.name,
                    port: { number: 80 },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  },
  { provider, dependsOn: [service, internalWildcardCert] }
);
