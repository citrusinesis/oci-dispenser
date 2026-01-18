#!/bin/bash
set -e

wait_for_apt() {
  while fuser /var/lib/apt/lists/lock /var/lib/dpkg/lock /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
    echo "Waiting for apt locks..."
    sleep 5
  done
}

echo "Getting public IP..."
PUBLIC_IP=$(curl -s ifconfig.me || curl -s icanhazip.com)
echo "Public IP: $PUBLIC_IP"

echo "Disabling SSH password authentication..."
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

echo "Installing iptables-persistent..."
wait_for_apt
DEBIAN_FRONTEND=noninteractive apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent

echo "Installing k3s..."
curl -sfL https://get.k3s.io | sh -s - \
  --tls-san $PUBLIC_IP \
  --tls-san 127.0.0.1 \
  --bind-address 0.0.0.0

echo "Configuring iptables..."
iptables -I INPUT 1 -p tcp --dport 6443 -j ACCEPT
iptables -I INPUT 1 -p udp --dport 41641 -j ACCEPT
netfilter-persistent save

echo "Installing Tailscale..."
curl -fsSL https://tailscale.com/install.sh | sh

echo "Authenticating Tailscale..."
tailscale up --authkey=${TAILSCALE_AUTH_KEY} --hostname=dispenser --ssh --accept-routes

echo "Setup complete!"
