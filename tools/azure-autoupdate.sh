#!/usr/bin/env bash
# Installs a self-updater on the game VM made by tools/azure-vm.sh. Every 5 minutes it checks main
# on GitHub; when main moved and no room is open, it pulls, rebuilds and restarts the server.
# Run once, as root on the VM (Cloud Shell does it for you):
#   az vm run-command invoke -g red-signal-centralindia -n red-signal-vm --command-id RunShellScript \
#     --scripts 'curl -fsSL <raw url of this file> | bash'
set -euo pipefail

cat >/usr/local/bin/redsignal-update <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
cd /opt/game || exit 0
as() { sudo -u redsignal -H "$@"; }
as git fetch -q origin main || exit 0
[ "$(as git rev-parse HEAD)" = "$(as git rev-parse origin/main)" ] && exit 0
# Never cut a running mission short: wait until every room is closed.
curl -fsS -m 5 http://localhost/healthz | grep -q '"rooms":0' || { echo "update waiting: rooms open"; exit 0; }
echo "updating to $(as git rev-parse --short origin/main)"
as git reset -q --hard origin/main &&
  as npm ci --no-audit --no-fund &&
  as npm run build &&
  systemctl restart redsignal
EOF
chmod +x /usr/local/bin/redsignal-update

cat >/etc/systemd/system/redsignal-update.service <<'EOF'
[Unit]
Description=Pull and rebuild RED SIGNAL when main changes
[Service]
Type=oneshot
ExecStart=/usr/local/bin/redsignal-update
EOF

cat >/etc/systemd/system/redsignal-update.timer <<'EOF'
[Unit]
Description=Check for RED SIGNAL updates every 5 minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now redsignal-update.timer
/usr/local/bin/redsignal-update || true
echo "auto-update installed"
