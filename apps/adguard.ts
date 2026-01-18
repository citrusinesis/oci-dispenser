import * as k8s from "@pulumi/kubernetes";
import { provider } from "../system/k3s";
import { operator } from "../system/tailscale";

const ns = new k8s.core.v1.Namespace(
  "adguard-system",
  {
    metadata: { name: "adguard" },
  },
  { provider }
);

const configPvc = new k8s.core.v1.PersistentVolumeClaim(
  "adguard-config-pvc",
  {
    metadata: { namespace: ns.metadata.name, name: "adguard-config" },
    spec: {
      accessModes: ["ReadWriteOnce"],
      resources: { requests: { storage: "1Gi" } },
      storageClassName: "local-path",
    },
  },
  { provider }
);

const workPvc = new k8s.core.v1.PersistentVolumeClaim(
  "adguard-work-pvc",
  {
    metadata: { namespace: ns.metadata.name, name: "adguard-work" },
    spec: {
      accessModes: ["ReadWriteOnce"],
      resources: { requests: { storage: "10Gi" } },
      storageClassName: "local-path",
    },
  },
  { provider }
);

const headlessService = new k8s.core.v1.Service(
  "adguard-headless",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "adguard-home",
    },
    spec: {
      clusterIP: "None",
      selector: { app: "adguard-home" },
      ports: [{ port: 80, targetPort: 80, name: "http" }],
    },
  },
  { provider, dependsOn: [ns] }
);

export const statefulSet = new k8s.apps.v1.StatefulSet(
  "adguard-home",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "adguard-home",
    },
    spec: {
      serviceName: "adguard-home",
      replicas: 1,
      selector: { matchLabels: { app: "adguard-home" } },
      template: {
        metadata: { labels: { app: "adguard-home" } },
        spec: {
          containers: [
            {
              name: "adguard-home",
              image: "adguard/adguardhome:v0.107.69",
              ports: [
                { containerPort: 80, name: "http" },
                { containerPort: 53, name: "dns-tcp", protocol: "TCP" },
                { containerPort: 53, name: "dns-udp", protocol: "UDP" },
                { containerPort: 3000, name: "admin" },
              ],
              volumeMounts: [
                { name: "config", mountPath: "/opt/adguardhome/conf" },
                { name: "work", mountPath: "/opt/adguardhome/work" },
              ],
              resources: {
                limits: { memory: "512Mi", cpu: "500m" },
                requests: { memory: "256Mi", cpu: "100m" },
              },
              livenessProbe: {
                httpGet: { path: "/", port: 80 },
                initialDelaySeconds: 60,
                periodSeconds: 10,
                failureThreshold: 6,
              },
              readinessProbe: {
                httpGet: { path: "/", port: 80 },
                initialDelaySeconds: 10,
                periodSeconds: 5,
                failureThreshold: 12,
              },
            },
          ],
          volumes: [
            {
              name: "config",
              persistentVolumeClaim: { claimName: configPvc.metadata.name },
            },
            {
              name: "work",
              persistentVolumeClaim: { claimName: workPvc.metadata.name },
            },
          ],
        },
      },
    },
  },
  { provider, dependsOn: [ns, configPvc, workPvc, headlessService] }
);

export const service = new k8s.core.v1.Service(
  "adguard-service",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "adguard-service",
      annotations: {
        "tailscale.com/expose": "true",
        "tailscale.com/hostname": "adguard",
      },
    },
    spec: {
      type: "LoadBalancer",
      loadBalancerClass: "tailscale",
      selector: { app: "adguard-home" },
      ports: [
        { port: 80, targetPort: 80, name: "http" },
        { port: 53, targetPort: 53, protocol: "UDP", name: "dns-udp" },
        { port: 53, targetPort: 53, protocol: "TCP", name: "dns-tcp" },
        { port: 3000, targetPort: 3000, name: "admin" },
      ],
    },
  },
  { provider, dependsOn: [operator] }
);
