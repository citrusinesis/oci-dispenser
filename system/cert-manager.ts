import * as command from "@pulumi/command";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import { domainName } from "../infrastructure/config";
import { provider } from "./k3s";
import { reflector } from "./reflector";

const config = new pulumi.Config("cloudflare");
const cloudflareApiToken = config.requireSecret("apiToken");
const cloudflareEmail = config.require("email");

// Install cert-manager via Helm
const certManagerNs = new k8s.core.v1.Namespace(
  "cert-manager-system",
  {
    metadata: { name: "cert-manager" },
  },
  { provider },
);

export const certManager = new k8s.helm.v3.Chart(
  "cert-manager",
  {
    chart: "cert-manager",
    version: "v1.14.2",
    fetchOpts: {
      repo: "https://charts.jetstack.io",
    },
    namespace: certManagerNs.metadata.name,
    values: {
      installCRDs: true,
      global: {
        leaderElection: {
          namespace: "cert-manager",
        },
      },
    },
  },
  { provider, dependsOn: [certManagerNs] },
);

// Cloudflare API Token Secret (for DNS-01 Challenge)
const cloudflareApiTokenSecret = new k8s.core.v1.Secret(
  "cloudflare-api-token",
  {
    metadata: {
      name: "cloudflare-api-token",
      namespace: certManagerNs.metadata.name,
    },
    stringData: {
      "api-token": cloudflareApiToken,
    },
  },
  { provider, dependsOn: [certManager] },
);

// Wait for cert-manager webhook to be ready
// The webhook takes some time to start serving requests even after the pod is ready.
const waitForWebhook = new command.local.Command(
  "wait-for-webhook",
  {
    create: "sleep 60",
  },
  { dependsOn: [certManager] },
);

// ClusterIssuer for Let's Encrypt (Production)
export const letsencryptIssuer = new k8s.apiextensions.CustomResource(
  "letsencrypt-prod",
  {
    apiVersion: "cert-manager.io/v1",
    kind: "ClusterIssuer",
    metadata: {
      name: "letsencrypt-prod",
    },
    spec: {
      acme: {
        server: "https://acme-v02.api.letsencrypt.org/directory",
        email: cloudflareEmail,
        privateKeySecretRef: {
          name: "letsencrypt-prod-account-key",
        },
        solvers: [
          {
            dns01: {
              cloudflare: {
                apiTokenSecretRef: {
                  name: cloudflareApiTokenSecret.metadata.name,
                  key: "api-token",
                },
              },
            },
          },
        ],
      },
    },
  },
  { provider, dependsOn: [certManager, cloudflareApiTokenSecret, waitForWebhook] },
);

export const internalWildcardCert = new k8s.apiextensions.CustomResource(
  "internal-wildcard-cert",
  {
    apiVersion: "cert-manager.io/v1",
    kind: "Certificate",
    metadata: {
      name: "internal-wildcard-tls",
      namespace: "default",
    },
    spec: {
      secretName: "internal-wildcard-tls",
      issuerRef: {
        name: letsencryptIssuer.metadata.name,
        kind: "ClusterIssuer",
      },
      dnsNames: [`*.${domainName}`, domainName],
      secretTemplate: {
        annotations: {
          "reflector.v1.k8s.emberstack.com/reflection-allowed": "true",
          "reflector.v1.k8s.emberstack.com/reflection-auto-enabled": "true",
          // Empty string = reflect to ALL namespaces
          "reflector.v1.k8s.emberstack.com/reflection-allowed-namespaces": "",
        },
      },
    },
  },
  { provider, dependsOn: [letsencryptIssuer, reflector] },
);
