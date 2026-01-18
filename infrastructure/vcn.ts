import * as oci from "@pulumi/oci";
import { compartmentId, allowPublicAccess } from "./config";

export const vcn = new oci.core.Vcn("main-vcn", {
  compartmentId: compartmentId,
  cidrBlock: "10.0.0.0/16",
  displayName: "oci-dispenser-vcn",
  dnsLabel: "ocidispenser",
});

export const internetGateway = new oci.core.InternetGateway("main-ig", {
  compartmentId: compartmentId,
  vcnId: vcn.id,
  displayName: "main-internet-gateway",
  enabled: true,
});

export const routeTable = new oci.core.RouteTable("main-rt", {
  compartmentId: compartmentId,
  vcnId: vcn.id,
  displayName: "main-route-table",
  routeRules: [
    {
      destination: "0.0.0.0/0",
      destinationType: "CIDR_BLOCK",
      networkEntityId: internetGateway.id,
    },
  ],
});

export const securityList = new oci.core.SecurityList("main-sl", {
  compartmentId: compartmentId,
  vcnId: vcn.id,
  displayName: "main-security-list",
  egressSecurityRules: [
    {
      destination: "0.0.0.0/0",
      protocol: "all",
      description: "Allow all egress",
    },
  ],
  ingressSecurityRules: [
    // Zero-Trust Philosophy: Block all public inbound traffic
    // Internal VCN traffic (required for k3s CNI/VXLAN)
    {
      protocol: "all",
      source: "10.0.0.0/16", // VCN CIDR
      description: "Allow all traffic within VCN (k3s CNI)",
    },
    // Tailscale UDP (Direct Connections)
    {
      protocol: "17", // UDP
      source: "0.0.0.0/0",
      udpOptions: {
        max: 41641,
        min: 41641,
      },
      description: "Tailscale Direct Connections",
    },
    // Conditional Public Access (SSH & k3s API)
    // Controlled by 'allowPublicAccess' config flag
    ...(allowPublicAccess
      ? [
          {
            protocol: "6", // TCP
            source: "0.0.0.0/0",
            tcpOptions: {
              max: 22,
              min: 22,
            },
            description: "Public SSH Access (Enabled via config)",
          },
          {
            protocol: "6", // TCP
            source: "0.0.0.0/0",
            tcpOptions: {
              max: 6443,
              min: 6443,
            },
            description: "Public k3s API Access (Enabled via config)",
          },
        ]
      : []),
  ],
});

export const subnet = new oci.core.Subnet("main-subnet", {
  compartmentId: compartmentId,
  vcnId: vcn.id,
  cidrBlock: "10.0.1.0/24",
  displayName: "main-subnet",
  routeTableId: routeTable.id,
  securityListIds: [securityList.id],
  dnsLabel: "main",
});
