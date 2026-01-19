import * as k8s from "@pulumi/kubernetes";
import { domainName } from "../infrastructure/config";
import { internalWildcardCert } from "../system/cert-manager";
import { provider } from "../system/k3s";

const ns = new k8s.core.v1.Namespace(
  "n8n-system",
  {
    metadata: { name: "n8n" },
  },
  { provider },
);

const dataPvc = new k8s.core.v1.PersistentVolumeClaim(
  "n8n-data-pvc",
  {
    metadata: { namespace: ns.metadata.name, name: "n8n-data" },
    spec: {
      accessModes: ["ReadWriteOnce"],
      resources: { requests: { storage: "5Gi" } },
      storageClassName: "local-path",
    },
  },
  { provider },
);

export const deployment = new k8s.apps.v1.Deployment(
  "n8n",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "n8n",
      labels: { app: "n8n" },
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: "n8n" } },
      template: {
        metadata: { labels: { app: "n8n" } },
        spec: {
          containers: [
            {
              name: "n8n",
              image: "n8nio/n8n:2.1.4",
              ports: [{ containerPort: 5678 }],
              env: [
                { name: "N8N_PORT", value: "5678" },
                { name: "N8N_PROTOCOL", value: "http" },
                { name: "N8N_HOST", value: `n8n.${domainName}` },
                { name: "WEBHOOK_URL", value: `https://n8n.${domainName}/` },
              ],
              volumeMounts: [{ name: "data", mountPath: "/home/node/.n8n" }],
              resources: {
                limits: { memory: "1Gi", cpu: "1000m" },
                requests: { memory: "512Mi", cpu: "200m" },
              },
              livenessProbe: {
                httpGet: { path: "/healthz", port: 5678 },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: { path: "/healthz", port: 5678 },
                initialDelaySeconds: 5,
                periodSeconds: 5,
              },
            },
          ],
          volumes: [
            {
              name: "data",
              persistentVolumeClaim: { claimName: dataPvc.metadata.name },
            },
          ],
        },
      },
    },
  },
  { provider, dependsOn: [ns, dataPvc] },
);

export const service = new k8s.core.v1.Service(
  "n8n-service",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "n8n-service",
    },
    spec: {
      selector: { app: "n8n" },
      ports: [{ port: 80, targetPort: 5678 }],
    },
  },
  { provider, dependsOn: [ns] },
);

export const ingress = new k8s.networking.v1.Ingress(
  "n8n-ingress",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "n8n-ingress",
    },
    spec: {
      ingressClassName: "traefik",
      tls: [
        {
          hosts: [`n8n.${domainName}`],
          secretName: "internal-wildcard-tls",
        },
      ],
      rules: [
        {
          host: `n8n.${domainName}`,
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
  { provider, dependsOn: [service, internalWildcardCert] },
);
