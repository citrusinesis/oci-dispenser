import * as appsAdguard from "./apps/adguard";
import * as appsLivesync from "./apps/livesync";
import * as appsN8n from "./apps/n8n";
import * as appsWhoami from "./apps/whoami";
import * as infrastructure from "./infrastructure/compute";
import * as systemCertManager from "./system/cert-manager";
import * as systemCloudflared from "./system/cloudflared";
import * as systemDashboard from "./system/dashboard";
import * as systemK3s from "./system/k3s";
import * as systemReflector from "./system/reflector";
import * as systemTailscale from "./system/tailscale";
import * as systemTraefik from "./system/traefik";

// Export useful outputs
export const publicIp = infrastructure.publicIp;
export const kubeconfig = systemK3s.k3sConfig;

// Ensure resources are created (side-effect imports)
export const tailscaleOperator = systemTailscale.operator;
export const cloudflaredDeployment = systemCloudflared.deployment;
export const certManager = systemCertManager.certManager;
export const reflector = systemReflector.reflector;
export const traefikGateway = systemTraefik.traefikTailscaleService;
export const adguardService = appsAdguard.service;
export const n8nIngress = appsN8n.ingress;
export const whoamiService = appsWhoami.service;
export const livesyncIngress = appsLivesync.ingress;
export const dashboardIngressRoute = systemDashboard.ingressRoute;
