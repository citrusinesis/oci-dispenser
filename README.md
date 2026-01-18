# Project Specification: OCI Fortress Home Server

## 1\. 프로젝트 개요 및 철학

이 프로젝트는 **OCI(Oracle Cloud Infrastructure)** 프리 티어 인스턴스 위에 구축되는 개인용 홈 서버이다.
핵심 철학은 \*\*"Inbound Zero, Tunneling Only"\*\*이다. 어떠한 인바운드 포트(SSH 제외)도 공용 인터넷에 노출하지 않으며, 모든 트래픽은 안전한 터널(Cloudflare, Tailscale)을 통해서만 진입한다.

  * **Cost Constraint:** **Always Free Tier (평생 무료) 한도를 엄격히 준수한다.** 추가 비용이 발생하지 않는 선에서 **최대 성능**을 확보한다.
  * **Orchestrator:** k3s (Lightweight Kubernetes)
  * **IaC Tool:** Pulumi (TypeScript)
  * **Network Strategy:** Hybrid Ingress (Public=Cloudflare, Private=Tailscale)
  * **DNS Strategy:** Tailscale Global Nameserver (via AdGuard Home)

## 2\. 아키텍처 디자인

### 2.1 네트워크 흐름 (Traffic Flow)

  * **Public Access (Web):** `User` -\> `Cloudflare Edge` -\> `Cloudflared (Pod)` -\> `k3s Service` -\> `App Pod`
  * **Private Access (Admin/Internal):** `Device` -\> `Tailscale VPN` -\> `Tailscale Operator (Proxy)` -\> `k3s Service` -\> `App Pod`
  * **DNS Query Flow:** `Tailscale Client` -\> `Tailscale Tunnel` -\> `OCI Instance` -\> `AdGuard Home (Pod)` -\> `Upstream DNS`

### 2.2 인프라 계층 (Infrastructure Layer)

  * **Provider:** OCI (Oracle Cloud Infrastructure)
  * **Compute Instance (Critical):**
      * **Shape:** `VM.Standard.A1.Flex` (ARM64 아키텍처)
      * **Spec:** **4 OCPUs, 24GB Memory** (Always Free 최대 한도 설정)
      * **OS Image:** Ubuntu 22.04 LTS (aarch64 / ARM64 build)
      * **Boot Volume:** 기본 50GB (또는 Always Free 한도인 200GB 내에서 최대 할당)
  * **Firewall (Security List):**
      * **Ingress:** Deny All (Optional: Allow SSH only from specific IP / Allow UDP 41641 for Tailscale optimization)
      * **Egress:** Allow All

### 2.3 스토리지 전략 (Persistence)

  * **Host Path:** OCI 인스턴스의 `/data` 디렉토리를 모든 영구 데이터의 루트로 사용.
  * **k3s StorageClass:** `Local Path Provisioner`를 사용하여 PV를 `/data/k3s-storage/` 하위에 자동 프로비저닝.

## 3\. 디렉토리 구조 (Pulumi Project)

AI 에이전트는 아래 구조를 엄격히 준수하여 코드를 생성해야 한다.

```text
my-homelab/
├── Pulumi.yaml             # 프로젝트 메인 설정
├── index.ts                # Entrypoint: 인프라 -> 시스템 -> 앱 순서로 모듈 호출
├── .gitignore
│
├── infrastructure/         # [Layer 1] OCI 인프라 리소스
│   ├── config.ts           # OCI 구획(Compartment), 리전 설정
│   ├── vcn.ts              # VCN, Subnet, Security List (Ingress 차단 규칙 포함)
│   └── compute.ts          # OCI Instance (A1 Flex, 4 OCPU/24GB) 생성 및 Cloud-init
│
├── system/                 # [Layer 2] 클러스터 핵심 컴포넌트
│   ├── k3s.ts              # Kubeconfig 로드 및 Provider 설정
│   ├── tailscale.ts        # Tailscale Operator Helm Chart 설치 & OAuth Client 설정
│   └── cloudflared.ts      # Cloudflare Tunnel Deployment & ConfigMap
│
├── apps/                   # [Layer 3] 애플리케이션 정의
│   ├── adguard.ts          # AdGuard Home (StatefulSet, Tailscale LoadBalancer)
│   ├── n8n.ts              # n8n Workflow (Deployment, Tailscale Ingress)
│   └── ... (Other Apps)

```

## 4\. 구현 요구사항 (Detailed Requirements)

### 4.1 시스템 컴포넌트 (System Layer)

1.  **Tailscale Operator:**
      * Helm Chart를 통해 배포한다.
      * OAuth Client Secret은 k3s Secret으로 관리한다.
      * **목표:** k3s `Service`나 `Ingress`에 Annotation을 붙이면 자동으로 Tailnet IP와 도메인을 할당해야 한다.
2.  **Cloudflared (Cloudflare Tunnel):**
      * Deployment로 배포하며, 복제본(Replicas)은 2개로 설정하여 가용성을 확보한다.
      * 터널 토큰은 k3s Secret으로 주입한다.
      * ARM64용 도커 이미지를 사용하도록 주의한다.

### 4.2 애플리케이션: AdGuard Home (핵심)

  * **Type:** `StatefulSet` (데이터 보존 필수)
  * **Network:**
      * Tailscale Operator를 통해 **LoadBalancer** 타입으로 노출한다.
      * Tailnet 내에서 고정된 Hostname (예: `adguard-oci`)을 가져야 한다.
  * **Volume:**
      * `/opt/adguardhome/conf` -\> PVC (Config)
      * `/opt/adguardhome/work` -\> PVC (Data)
  * **Post-Deployment Action:**
      * 할당받은 Tailscale IP를 Tailscale Admin Console의 **Global Nameserver**로 등록한다.
      * "Override Local DNS" 기능을 활성화한다.

### 4.3 애플리케이션: 일반 앱 (예: n8n)

  * **Type:** `Deployment`
  * **Network:**
      * 외부 공개가 불필요하므로 **Tailscale Ingress**를 사용한다.
      * HTTPS (`n8n.tailnet-name.ts.net`) 접속이 가능해야 한다.

## 5\. 에이전트 작업 가이드라인 (Instruction for Agent)

1.  **Context Awareness:** 코드를 생성할 때 위 디렉토리 구조의 어느 파일에 위치해야 하는지 명시하라.
2.  **Cost Optimization:** `infrastructure/compute.ts` 작성 시 `VM.Standard.A1.Flex` Shape과 `ocpus: 4`, `memoryInGBs: 24` 설정을 필수로 포함하라.
3.  **Architecture Check:** 이미지 선택 시 **ARM64 (aarch64)** 호환성을 반드시 확인하라. (Docker Image Tag 등)
4.  **Security First:** 보안 그룹 설정 시 0.0.0.0/0에 대한 인바운드 허용은 절대 금지한다.
5.  **Idempotency:** Pulumi 코드는 멱등성을 유지해야 한다.

## 6. 시크릿 설정
# 1. SSH 키 생성 (없다면)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/oci_dispenser

# 2. Pulumi 로컬 로그인
pulumi login --local

# 3. Stack 생성
pulumi stack init dev

# 4. OCI 설정
pulumi config set oci:compartmentId "ocid1.compartment.oc1..YOUR_COMPARTMENT_ID"
pulumi config set oci:region "ap-seoul-1"
pulumi config set oci:sshPublicKey "$(cat ~/.ssh/oci_dispenser.pub)"

# 5. Tailscale OAuth 설정
pulumi config set tailscale:oauthClientId "YOUR_CLIENT_ID"
pulumi config set --secret tailscale:oauthClientSecret "YOUR_CLIENT_SECRET"

# 6. Cloudflare Tunnel 설정
pulumi config set --secret cloudflare:tunnelToken "YOUR_TUNNEL_TOKEN"

# 7. SSH Private Key 환경 변수
export SSH_PRIVATE_KEY="$(cat ~/.ssh/oci_dispenser)"

# 8. 설정 확인
pulumi config

# 9. Preview
pulumi preview