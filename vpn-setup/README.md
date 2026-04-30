# VPC Setup - Starken OS Virtual Desktop

## Overview
Configura um servidor VNC na VPS para acessar um desktop virtual completo do seu Mac.

## Requisitos
- Acesso SSH à VPS: `187.77.46.199`
- Terminal/SSH client no Mac

## Instalação Rápida

### 1. Conecte na VPS via SSH
```bash
ssh root@187.77.46.199
```
Senha: `Starken2026@#`

### 2. Execute o script de setup
```bash
curl -fsSL https://raw.githubusercontent.com/ferramentastecnologia/starken-os/claude/setup-starken-vpn-Zkp6n/vpn-setup/install-vnc-server.sh | bash
```

Ou download e execute localmente:
```bash
bash install-vnc-server.sh
```

### 3. Defina a senha VNC
O script pedirá uma senha durante a instalação. Use uma senha forte (mínimo 6 caracteres).

## Conectando do Mac

### Opção 1: Conexão Direta (mais simples)
1. Abra **Finder** → **Go** → **Connect to Server**
2. Digite: `vnc://187.77.46.199:5901`
3. Pressione Enter e insira a senha VNC

### Opção 2: SSH Tunnel (mais seguro)
```bash
ssh -L 5901:localhost:5901 root@187.77.46.199
```

Em outro terminal:
```bash
open vnc://localhost:5901
```

## Verificar Status

Na VPS:
```bash
systemctl status vncserver@:1.service
```

Reiniciar VNC:
```bash
systemctl restart vncserver@:1.service
```

## Portas
- **Display :1** → Porta `5901`
- **Display :2** → Porta `5902` (se criar outra)

## Desktop Environment
- **XFCE4** - leve, rápido e estável
- Terminal: `xfce4-terminal`

## Troubleshooting

### Conexão recusada
```bash
# Verifique se VNC está rodando
sudo systemctl status vncserver@:1.service

# Reinicie
sudo systemctl restart vncserver@:1.service

# Verifique porta
ss -tulpn | grep 5901
```

### Mudar resolução
Edit: `~/.vnc/xstartup`
```bash
vncserver -geometry 1280x720 :1
```

### Parar VNC
```bash
systemctl stop vncserver@:1.service
```

## Next Steps
Após conectar e ter o desktop rodando, você pode:
- Clonar repositórios
- Instalar ferramentas de desenvolvimento
- Configurar ambiente da Starken OS
- Editar código

Será definido depois conforme suas necessidades!
