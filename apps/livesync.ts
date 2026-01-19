import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import { domainName } from "../infrastructure/config";
import { internalWildcardCert } from "../system/cert-manager";
import { provider } from "../system/k3s";

const config = new pulumi.Config("livesync");
const couchdbUser = config.get("couchdbUser") || "obsidian";
const couchdbPassword = config.requireSecret("couchdbPassword");

const ns = new k8s.core.v1.Namespace(
  "livesync-system",
  {
    metadata: { name: "obsidian-livesync" },
  },
  { provider },
);

const secret = new k8s.core.v1.Secret(
  "couchdb-auth",
  {
    metadata: {
      name: "couchdb-auth",
      namespace: ns.metadata.name,
    },
    stringData: {
      COUCHDB_USER: couchdbUser,
      COUCHDB_PASSWORD: couchdbPassword,
    },
  },
  { provider, dependsOn: [ns] },
);

const dataPvc = new k8s.core.v1.PersistentVolumeClaim(
  "couchdb-data-pvc",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "couchdb-data",
    },
    spec: {
      accessModes: ["ReadWriteOnce"],
      resources: { requests: { storage: "50Gi" } },
      storageClassName: "local-path",
    },
  },
  { provider, dependsOn: [ns] },
);

const headlessService = new k8s.core.v1.Service(
  "couchdb-headless",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "couchdb",
    },
    spec: {
      clusterIP: "None",
      selector: { app: "couchdb" },
      ports: [{ port: 5984, targetPort: 5984, name: "http" }],
    },
  },
  { provider, dependsOn: [ns] },
);

export const statefulSet = new k8s.apps.v1.StatefulSet(
  "couchdb",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "couchdb",
    },
    spec: {
      serviceName: "couchdb",
      replicas: 1,
      selector: { matchLabels: { app: "couchdb" } },
      template: {
        metadata: { labels: { app: "couchdb" } },
        spec: {
          securityContext: {
            fsGroup: 5984,
          },
          initContainers: [
            {
              name: "init-permissions",
              image: "busybox:1.36",
              command: [
                "sh",
                "-c",
                "mkdir -p /mnt/data /mnt/etc-local.d && chown -R 5984:5984 /mnt",
              ],
              volumeMounts: [{ name: "couchdb-storage", mountPath: "/mnt" }],
            },
          ],
          containers: [
            {
              name: "couchdb",
              image: "couchdb:3",
              ports: [{ containerPort: 5984, name: "http" }],
              env: [
                {
                  name: "COUCHDB_USER",
                  valueFrom: {
                    secretKeyRef: {
                      name: secret.metadata.name,
                      key: "COUCHDB_USER",
                    },
                  },
                },
                {
                  name: "COUCHDB_PASSWORD",
                  valueFrom: {
                    secretKeyRef: {
                      name: secret.metadata.name,
                      key: "COUCHDB_PASSWORD",
                    },
                  },
                },
              ],
              volumeMounts: [
                {
                  name: "couchdb-storage",
                  mountPath: "/opt/couchdb/data",
                  subPath: "data",
                },
                {
                  name: "couchdb-storage",
                  mountPath: "/opt/couchdb/etc/local.d",
                  subPath: "etc-local.d",
                },
              ],
              resources: {
                limits: { memory: "512Mi", cpu: "500m" },
                requests: { memory: "256Mi", cpu: "100m" },
              },
              readinessProbe: {
                tcpSocket: { port: 5984 },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
              livenessProbe: {
                tcpSocket: { port: 5984 },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
            },
          ],
          volumes: [
            {
              name: "couchdb-storage",
              persistentVolumeClaim: { claimName: dataPvc.metadata.name },
            },
          ],
        },
      },
    },
  },
  { provider, dependsOn: [ns, dataPvc, headlessService, secret] },
);

export const service = new k8s.core.v1.Service(
  "couchdb-service",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "couchdb-service",
    },
    spec: {
      selector: { app: "couchdb" },
      ports: [{ port: 5984, targetPort: 5984 }],
    },
  },
  { provider, dependsOn: [ns] },
);

export const ingress = new k8s.networking.v1.Ingress(
  "livesync-ingress",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "livesync-ingress",
    },
    spec: {
      ingressClassName: "traefik",
      tls: [
        {
          hosts: [`livesync.${domainName}`],
          secretName: "internal-wildcard-tls",
        },
      ],
      rules: [
        {
          host: `livesync.${domainName}`,
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: service.metadata.name,
                    port: { number: 5984 },
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

// CouchDB initialization job for LiveSync
// Runs the official couchdb-init.sh script to configure single-node mode, CORS, etc.
export const initJob = new k8s.batch.v1.Job(
  "couchdb-init",
  {
    metadata: {
      namespace: ns.metadata.name,
      name: "couchdb-init",
    },
    spec: {
      backoffLimit: 5,
      template: {
        spec: {
          restartPolicy: "OnFailure",
          containers: [
            {
              name: "init",
              image: "alpine:3.20",
              env: [
                {
                  name: "COUCHDB_USER",
                  valueFrom: {
                    secretKeyRef: {
                      name: secret.metadata.name,
                      key: "COUCHDB_USER",
                    },
                  },
                },
                {
                  name: "COUCHDB_PASSWORD",
                  valueFrom: {
                    secretKeyRef: {
                      name: secret.metadata.name,
                      key: "COUCHDB_PASSWORD",
                    },
                  },
                },
              ],
              command: [
                "sh",
                "-c",
                `apk add --no-cache curl bash && \
curl -s https://raw.githubusercontent.com/vrtmrz/obsidian-livesync/main/utils/couchdb/couchdb-init.sh | \
hostname=http://couchdb-service:5984 username="$COUCHDB_USER" password="$COUCHDB_PASSWORD" bash`,
              ],
            },
          ],
        },
      },
    },
  },
  { provider, dependsOn: [statefulSet, service] },
);
