#!/usr/bin/env bash
# Armbian Setup Script for BananaPi BPI-P2Pro (RK3308 PoE) AES67 Paging Speaker
set -euo pipefail

echo "=== Installing AES67 Paging Speaker Dependencies ==="
apt-get update
apt-get install -y --no-install-recommends \
  python3 python3-gi python3-pip python3-aiohttp python3-alsaaudio \
  python3-gpiod python3-smbus i2c-tools linuxptp libwebrtc-audio-processing1 \
  gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-alsa gir1.2-gstreamer-1.0

pip3 install --break-system-packages luma.oled ldap3 PyJWT cryptography

echo "=== Configuring Armbian Device Tree Overlays (I2S + I2C OLED) ==="
ARMBIAN_ENV="/boot/armbianEnv.txt"
if [ -f "$ARMBIAN_ENV" ]; then
  grep -q "^overlays=" "$ARMBIAN_ENV" || echo "overlays=" >> "$ARMBIAN_ENV"
  sed -i 's/^overlays=.*/overlays=rk3308-i2c0 rk3308-i2s0-out rk3308-i2s1-in/' "$ARMBIAN_ENV"
fi

echo "=== Optimizing PoE Power Consumption ==="
# Set CPU governor to powersave/ondemand and disable unused HDMI/Wi-Fi/BT
cat >/etc/default/cpufrequtils <<'EOF'
ENABLE="true"
GOVERNOR="powersave"
MAX_SPEED="816000"
MIN_SPEED="408000"
EOF

systemctl disable --now bluetooth.service wpa_supplicant.service 2>/dev/null || true

echo "=== Configuring IEEE-1588v2 PTP Clock Sync (AES67) ==="
cat >/etc/linuxptp/ptp4l.conf <<'EOF'
[global]
slaveOnly               1
domainNumber            0
network_transport       UDPv4
delay_mechanism         E2E
logging_level           4
EOF

mkdir -p /opt/aes67-pager /etc/aes67-pager
cp aes67_daemon.py /opt/aes67-pager/aes67_daemon.py
chmod +x /opt/aes67-pager/aes67_daemon.py
cp aes67-pager.service /etc/systemd/system/aes67-pager.service

systemctl daemon-reload
systemctl enable --now ptp4l aes67-pager.service
echo "=== Setup Complete. Reboot recommended to apply I2S/I2C Device Tree overlays. ==="
