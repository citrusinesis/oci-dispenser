import * as k8s from "@pulumi/kubernetes";
import { domainName } from "../infrastructure/config";
import { internalWildcardCert } from "./cert-manager";
import { provider } from "./k3s";

const ns = new k8s.core.v1.Namespace(
  "kubernetes-dashboard",
  {
    metadata: { name: "kubernetes-dashboard" },
  },
  { provider },
);

// Install Kubernetes Dashboard via Helm
export const dashboard = new k8s.helm.v3.Chart(
  "kubernetes-dashboard",
  {
    chart: "kubernetes-dashboard",
    version: "7.0.0", // Check for latest stable
    fetchOpts: {
      repo: "https://kubernetes.github.io/dashboard/",
    },
    namespace: ns.metadata.name,
    values: {
      // We will handle Ingress separately to use our specific Traefik setup
      ingress: { enabled: false },
      metricsScraper: { enabled: true },
    },
  },
  { provider, dependsOn: [ns] },
);

// Create Admin ServiceAccount
const adminUser = new k8s.core.v1.ServiceAccount(
  "admin-user",
  {
    metadata: {
      name: "admin-user",
      namespace: ns.metadata.name,
    },
  },
  { provider, dependsOn: [ns] },
);

// WARNING: cluster-admin grants full cluster access. This is required for
// dashboard functionality but is a security concern. In production, consider
// creating a more restrictive ClusterRole with only necessary permissions.
new k8s.rbac.v1.ClusterRoleBinding(
  "admin-user-binding",
  {
    metadata: { name: "admin-user" },
    roleRef: {
      apiGroup: "rbac.authorization.k8s.io",
      kind: "ClusterRole",
      name: "cluster-admin",
    },
    subjects: [
      {
        kind: "ServiceAccount",
        name: adminUser.metadata.name,
        namespace: ns.metadata.name,
      },
    ],
  },
  { provider, dependsOn: [adminUser] },
);

// Expose via Traefik Internal Gateway
// Expose via Traefik IngressRoute (CRD) to handle backend TLS verification skipping
// Kubernetes Dashboard v7+ uses self-signed certs, so Traefik needs to trust it or skip verification.
export const ingressRoute = new k8s.apiextensions.CustomResource(
  "dashboard-ingress-route",
  {
    apiVersion: "traefik.io/v1alpha1",
    kind: "IngressRoute",
    metadata: {
      name: "dashboard-ingress-route",
      namespace: ns.metadata.name,
    },
    spec: {
      entryPoints: ["websecure"],
      routes: [
        {
          match: `Host(\`dashboard.${domainName}\`)`,
          kind: "Rule",
          services: [
            {
              name: "kubernetes-dashboard-kong-proxy",
              port: 443,
              scheme: "https",
              serversTransport: "kubernetes-dashboard-dashboard-transport@kubernetescrd",
            },
          ],
        },
      ],
      tls: {
        secretName: "internal-wildcard-tls",
      },
    },
  },
  { provider, dependsOn: [dashboard, internalWildcardCert] },
);

// Define ServersTransport to skip backend TLS verification
export const dashboardTransport = new k8s.apiextensions.CustomResource(
  "dashboard-transport",
  {
    apiVersion: "traefik.io/v1alpha1",
    kind: "ServersTransport",
    metadata: {
      name: "dashboard-transport",
      namespace: ns.metadata.name,
    },
    spec: {
      insecureSkipVerify: true,
    },
  },
  { provider, dependsOn: [ns] },
);
