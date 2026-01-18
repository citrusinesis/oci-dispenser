import * as k8s from "@pulumi/kubernetes";
import { provider } from "./k3s";

// Reflector - Automatically copies secrets/configmaps across namespaces
// Used to distribute the wildcard TLS certificate to all namespaces
// https://github.com/emberstack/kubernetes-reflector

const ns = new k8s.core.v1.Namespace(
  "reflector-system",
  {
    metadata: { name: "reflector" },
  },
  { provider }
);

export const reflector = new k8s.helm.v3.Chart(
  "reflector",
  {
    chart: "reflector",
    version: "9.1.39", // Check for latest: https://artifacthub.io/packages/helm/emberstack/reflector
    fetchOpts: {
      repo: "https://emberstack.github.io/helm-charts",
    },
    namespace: ns.metadata.name,
    values: {
      // Reflector configuration
      nameOverride: "reflector",
      fullnameOverride: "reflector",
    },
  },
  { provider, dependsOn: [ns] }
);
