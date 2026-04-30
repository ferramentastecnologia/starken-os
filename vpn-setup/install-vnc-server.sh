#!/bin/bash
# Starken OS - VNC Desktop Server Setup
# Execute as root: bash install-vnc-server.sh

set -e

echo "🚀 Instalando servidor VNC para desktop virtual..."

# Update system
apt-get update -y

# Install VNC server and lightweight desktop environment
apt-get install -y tigervnc-server tigervnc-common

# Install lightweight desktop (XFCE - balance between features and performance)
apt-get install -y xfce4 xfce4-terminal

# Create VNC startup script for root
mkdir -p ~/.vnc
cat > ~/.vnc/xstartup << 'EOF'
#!/bin/bash
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
exec startxfce4 &
EOF

chmod +x ~/.vnc/xstartup

# Set VNC password (change this to your preferred password)
mkdir -p ~/.vnc
echo "Digite a senha VNC (mínimo 6 caracteres):"
vncpasswd

# Create systemd service for VNC server
cat > /etc/systemd/system/vncserver@.service << 'EOF'
[Unit]
Description=TigerVNC server on %i
After=syslog.target network-online.target remote-fs.target nss-lookup.target
Wants=network-online.target

[Service]
Type=forking
User=root
PAMName=login
PIDFile=/root/.vnc/%H%i.pid
ExecStartPre=/bin/sh -c '/usr/bin/vncserver -kill %i > /dev/null 2>&1 || :'
ExecStart=/usr/bin/vncserver -geometry 1920x1080 -depth 24 %i
ExecStop=/usr/bin/vncserver -kill %i
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

# Enable and start VNC service on display :1
systemctl daemon-reload
systemctl enable vncserver@:1.service
systemctl start vncserver@:1.service

echo ""
echo "✅ VNC Server instalado e rodando!"
echo ""
echo "📋 Informações de conexão:"
echo "   Host: 187.77.46.199"
echo "   Porta: 5901 (display :1)"
echo ""
echo "🍎 Para conectar do Mac:"
echo "   1. Abra Finder > Go > Connect to Server"
echo "   2. Digite: vnc://187.77.46.199:5901"
echo "   3. Insira a senha que você definiu acima"
echo ""
echo "💡 Alternativa com SSH tunnel (mais seguro):"
echo "   ssh -L 5901:localhost:5901 root@187.77.46.199"
echo "   Depois conecte em: vnc://localhost:5901"
echo ""

# Check status
systemctl status vncserver@:1.service
