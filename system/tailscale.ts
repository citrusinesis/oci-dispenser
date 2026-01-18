import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import { provider } from "./k3s";

const config = new pulumi.Config("tailscale");
const oauthClientId = config.require("oauthClientId");
const oauthClientSecret = config.requireSecret("oauthClientSecret");

// Create a namespace for Tailscale
const ns = new k8s.core.v1.Namespace(
  "tailscale-system",
  {
    metadata: { name: "tailscale" },
  },
  { provider }
);

// Create Secret for OAuth Client
new k8s.core.v1.Secret(
  "tailscale-auth",
  {
    metadata: {
      name: "tailscale-auth",
      namespace: ns.metadata.name,
    },
    stringData: {
      "client-id": oauthClientId,
      "client-secret": oauthClientSecret,
    },
  },
  { provider }
);

// Install Tailscale Operator via Helm Chart
export const operator = new k8s.helm.v3.Chart(
  "tailscale-operator",
  {
    chart: "tailscale-operator",
    version: "1.90.8",
    fetchOpts: {
      repo: "https://pkgs.tailscale.com/helmcharts",
    },
    namespace: ns.metadata.name,
    values: {
      oauth: {
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
      },
      operatorConfig: {
        hostname: "lab", // Operator pod's Tailscale hostname
      },
      proxyConfig: {
        defaultTags: "tag:k8s",
      },
    },
  },
  { provider, dependsOn: [ns] }
);

// Exit Node using Connector CRD - the correct way to advertise exit node
// The Connector CRD properly configures the Tailscale proxy to advertise as an exit node
export const exitNodeConnector = new k8s.apiextensions.CustomResource(
  "tailscale-exit-node-connector",
  {
    apiVersion: "tailscale.com/v1alpha1",
    kind: "Connector",
    metadata: {
      name: "dispenser-exit",
    },
    spec: {
      hostname: "dispenser-exit",
      exitNode: true,
      tags: ["tag:k8s"],
    },
  },
  { provider, dependsOn: [operator] }
);
