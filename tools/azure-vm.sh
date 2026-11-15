#!/usr/bin/env bash
# One-shot game server on an Azure VM, for Azure Cloud Shell (already signed in):
#   curl -fsSL <raw url of this file> | bash
# Tries regions and sizes until the subscription's quota allows one, then installs Node 22,
# builds the game from main and runs it on port 80 as a systemd service.
set -uo pipefail

GROUP="${GROUP:-red-signal}"
VM="${VM:-red-signal-vm}"
REPO="${REPO:-https://github.com/Nurmukasan/Nasa-Space-App-Challange.git}"
REGIONS="${REGIONS:-eastus westus2 centralus eastus2 westeurope northeurope swedencentral uksouth polandcentral germanywestcentral francecentral}"
SIZES="${SIZES:-Standard_D2as_v5 Standard_D2s_v5 Standard_B2s Standard_B2ms Standard_D2ads_v5 Standard_B2ats_v2 Standard_B1s Standard_F2s_v2}"
IMAGE="Canonical:ubuntu-24_04-lts:server:latest"

INIT="$(mktemp)"
cat >"$INIT" <<EOF
#cloud-config
runcmd:
  - fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  - echo '/swapfile none swap sw 0 0' >> /etc/fstab
  - curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  - apt-get install -y nodejs git
  - git clone $REPO /opt/game
  - chown -R redsignal:redsignal /opt/game
  - sudo -u redsignal -H bash -c 'cd /opt/game && npm ci && npm run build'
  - |
    cat > /etc/systemd/system/redsignal.service <<'UNIT'
    [Unit]
    Description=RED SIGNAL game server
    After=network.target
    [Service]
    User=redsignal
    WorkingDirectory=/opt/game
    Environment=NODE_ENV=production
    Environment=PORT=80
    AmbientCapabilities=CAP_NET_BIND_SERVICE
    ExecStart=/usr/bin/npm start
    Restart=always
    [Install]
    WantedBy=multi-user.target
    UNIT
  - systemctl daemon-reload
  - systemctl enable --now redsignal
EOF

say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }

az provider register --namespace Microsoft.Compute >/dev/null 2>&1
az provider register --namespace Microsoft.Network >/dev/null 2>&1

# Clean up the half-made group from an earlier portal attempt (it only holds network pieces).
for g in $(az group list --query "[?starts_with(name, 'red-signal-vm_group')].name" -o tsv); do
  say "Deleting leftover group $g"
  az group delete -n "$g" --yes --no-wait
done

# One group per region ("red-signal-eastus"...): a failed try is deleted whole, nothing collides.
EXISTING=$(az vm list --query "[?name=='$VM' && starts_with(resourceGroup, '$GROUP-')].resourceGroup | [0]" -o tsv 2>/dev/null)
if [ -n "$EXISTING" ]; then
  say "VM already exists in $EXISTING, skipping creation"
  GROUP="$EXISTING"
  CREATED=1
else
  CREATED=0
  BASE="$GROUP"
  for region in $REGIONS; do
    # Skip regions without any free regional cores.
    free=$(az vm list-usage -l "$region" --query "[?name.value=='cores'] | [0].[limit, currentValue]" -o tsv 2>/dev/null | paste -sd' ' | awk '{print $1-$2}')
    if [ -z "$free" ] || [ "$free" -lt 1 ]; then
      echo "  $region: no free cores, skip"
      continue
    fi
    GROUP="$BASE-$region"
    for size in $SIZES; do
      say "Trying $size in $region"
      az group create -n "$GROUP" -l "$region" -o none || continue
      if az vm create -g "$GROUP" -n "$VM" -l "$region" --image "$IMAGE" --size "$size" \
        --admin-username redsignal --generate-ssh-keys --public-ip-sku Standard \
        --os-disk-size-gb 64 --custom-data "$INIT" -o none; then
        CREATED=1
        break 2
      fi
      say "Failed, cleaning up and trying the next option"
      az group delete -n "$GROUP" --yes
    done
  done
fi

if [ "$CREATED" != "1" ]; then
  say "No region/size worked. Copy the errors above and send them over."
  exit 1
fi

az vm open-port -g "$GROUP" -n "$VM" --port 80 --priority 900 -o none
NAME="redsignal$(az account show --query id -o tsv | cut -c1-6)"
az network public-ip update -g "$GROUP" -n "${VM}PublicIP" --dns-name "$NAME" -o none 2>/dev/null
IP=$(az vm show -d -g "$GROUP" -n "$VM" --query publicIps -o tsv)
FQDN=$(az network public-ip show -g "$GROUP" -n "${VM}PublicIP" --query dnsSettings.fqdn -o tsv 2>/dev/null)

say "VM is up at $IP. Installing and building the game (5-10 minutes)..."
for _ in $(seq 1 90); do
  if curl -fsS -m 5 "http://$IP/healthz" >/dev/null 2>&1; then
    say "READY! Play at:  http://${FQDN:-$IP}   (or http://$IP)"
    echo "Update later:  az vm run-command invoke -g $GROUP -n $VM --command-id RunShellScript --scripts 'cd /opt/game && sudo -u redsignal git pull && sudo -u redsignal npm ci && sudo -u redsignal npm run build && systemctl restart redsignal'"
    echo "Delete all:    az group delete -n $GROUP --yes"
    exit 0
  fi
  sleep 10
done
say "Still building after 15 minutes. Check:  az vm run-command invoke -g $GROUP -n $VM --command-id RunShellScript --scripts 'tail -40 /var/log/cloud-init-output.log; systemctl status redsignal --no-pager'"
