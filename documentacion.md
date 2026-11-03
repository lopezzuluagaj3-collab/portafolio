```text
[ INTERNET / ATACANTES / ESCÁNERES ]
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. KERNEL LINUX & SYSCTL (Stealth Mode)                                     │
│    • ICMP Echo Request desactivado (No responde Pings).                     │
│    • Descarte silencioso (DROP) de escaneos TCP inválidos (NULL, XMAS, FIN).│
│    • Trampa de puertos señuelo (Blacklist temporal a atacantes por 24h).    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. CROWDSEC FIREWALL BOUNCER (Kernel iptables: DOCKER-USER & INPUT)         │
│    • Descarta en el kernel IPs que superan rate limits o hacen scraping.    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. PERÍMETRO SSH DINÁMICO (Port Knocking con knockd)                        │
│    • Puerto 17294 cerrado por defecto (DROP).                               │
│    • Golpe TCP a secuencia secreta -> Abre puerto a tu IP por 25s.          │
│    • Autenticación obligatoria por llave RSA/PEM (Contraseñas prohibidas).  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. TRÁFICO HTTP/HTTPS PÚBLICO (Puertos 80 / 443)                            │
│    • Nginx Proxy Manager (NPM): Enruta dominios a contenedores internos.    │
│    • Panel de Control (Puerto 81): Aislado en 127.0.0.1 (Túnel SSH).       │
│    • CrowdSec Agent: Lee logs de NPM y emite órdenes de bloqueo inmediatas. │
└─────────────────────────────────────────────────────────────────────────────┘
2. Hardening de SSH y Migración de Puerto¿Por qué se hizo?Cambio de puerto (22 a 17294): Reduce en más de un 95% el ruido en los logs causado por bots de escaneo indiscriminado en IPv4.Autenticación exclusiva por llave: Invalida cualquier vector de ataque por diccionario o fuerza bruta contra cuentas de usuario.Problemas encontrados y resoluciónConflicto ssh.socket de Systemd: En distribuciones Ubuntu recientes, sshd no escucha directamente según /etc/ssh/sshd_config, sino a través de un socket administrado por systemd (ssh.socket) que bloquea el puerto 22.Solución: Se desactivó ssh.socket y se activó el servicio clásico ssh.service.Precedencia de cloud-init: OpenSSH toma la primera directiva que lee. El archivo /etc/ssh/sshd_config.d/50-cloud-init.conf forzaba PasswordAuthentication yes, ignorando los cambios en el archivo principal.Solución: Se modificó 50-cloud-init.conf y se creó un override de mayor precedencia alfabética (00-disable-passwords.conf).Guía de ReplicaciónA. Configurar llaves y deshabilitar contraseñasEn la máquina cliente (PowerShell), generar el par de llaves:PowerShellssh-keygen -t rsa -b 4096 -m PEM -f "$HOME\.ssh\id_rsa_vps"
Get-Content "$HOME\.ssh\id_rsa_vps.pub"
En el servidor VPS, registrar la clave pública:Bashmkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "PEGA_AQUI_LA_CLAVE_PUBLICA" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
Anular la reactivación de contraseñas por cloud-init:Bashsudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/g' /etc/ssh/sshd_config.d/50-cloud-init.conf 2>/dev/null || true
sudo tee /etc/ssh/sshd_config.d/00-disable-passwords.conf << 'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
EOF
B. Cambiar el puerto y deshabilitar el socket de systemdConfigurar el puerto en /etc/ssh/sshd_config:Bashsudo sed -i 's/^#*Port .*/Port 17294/' /etc/ssh/sshd_config
Migrar de ssh.socket a ssh.service:Bashsudo systemctl disable --now ssh.socket
sudo systemctl enable --now ssh.service
sudo sshd -t && sudo systemctl restart ssh.service
Verificar que esté escuchando únicamente en el puerto 17294:Bashsudo ss -tulpn | grep 17294
3. Implementación de Port Knocking (knockd)¿Por qué se hizo?El puerto 17294 se mantiene completamente cerrado en el firewall (DROP). Únicamente cuando un cliente envía una secuencia específica de paquetes TCP a puertos cerrados (7481 -> 8293 -> 9102), el demonio knockd ejecuta un comando a nivel de kernel para permitir el acceso a esa IP durante 25 segundos. Pasado ese tiempo, el puerto se cierra nuevamente. Las sesiones SSH ya abiertas no se caen gracias al estado ESTABLISHED,RELATED de iptables.Problemas encontrados y resoluciónInconsistencia de interfaz en systemd: knockd fallaba al leer la interfaz desde /etc/default/knockd.Solución: Se especificó explícitamente la interfaz de red pública (-i eth0 o correspondiente) mediante un drop-in override de systemd.Guía de ReplicaciónObtener el nombre de la interfaz pública de red:BashIFACE=$(ip route show default | awk '{print $5}')
Instalar knockd:Bashsudo apt update && sudo apt install -y knockd
Configurar /etc/knockd.conf:Bashsudo tee /etc/knockd.conf << 'EOF'
[options]
        UseSyslog

[opencloseSSH]
        sequence    = 7481:tcp,8293:tcp,9102:tcp
        seq_timeout = 5
        tcpflags    = syn
        start_command = /usr/sbin/iptables -I INPUT -s %IP% -p tcp --dport 17294 -j ACCEPT
        cmd_timeout   = 25
        stop_command  = /usr/sbin/iptables -D INPUT -s %IP% -p tcp --dport 17294 -j ACCEPT
EOF
Configurar el override del servicio systemd para vincular la interfaz:Bashsudo mkdir -p /etc/systemd/system/knockd.service.d
sudo tee /etc/systemd/system/knockd.service.d/override.conf << EOF
[Service]
ExecStart=
ExecStart=/usr/sbin/knockd -i $IFACE
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now knockd
Eliminar cualquier regla persistente del puerto 17294 en el firewall para dejarlo sellado:Bashsudo ufw delete allow 17294/tcp 2>/dev/null || true
sudo ufw reload
4. Script de Automatización del Cliente (PowerShell)¿Por qué se hizo?Realizar el "toque" de puertos manual con herramientas externas es lento. Un script de PowerShell ejecuta los sockets TCP en milisegundos e inicia la conexión SSH inmediatamente, abriendo a su vez un túnel para el panel de Nginx Proxy Manager.Script connect-vps.ps1Guardar en el equipo cliente (por ejemplo, C:\Users\lopez\OneDrive\Desktop\connect-vps.ps1):PowerShell<#
.SYNOPSIS
    Automatización de Port Knocking, Túnel Seguro y Conexión SSH a VPS.
#>

param(
    [string]$ServerIP = "204.168.192.65",
    [int]$SSHPort = 17294,
    [string]$User = "devops",
    [string]$KeyPath = "$HOME\.ssh\id_rsa_vps",
    [int[]]$KnockSequence = @(7481, 8293, 9102),
    [int]$LocalTunnelPort = 8181,
    [int]$RemoteAdminPort = 81
)

if (-not (Test-Path $KeyPath)) {
    Write-Error "[-] No se encontró la llave privada en: $KeyPath"
    exit 1
}

Write-Host "[*] Enviando secuencia de Knocking hacia $ServerIP..." -ForegroundColor Cyan

foreach ($port in $KnockSequence) {
    Write-Host "    -> Golpeando puerto $port..." -NoNewline
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($ServerIP, $port, $null, $null)
        $async.AsyncWaitHandle.WaitOne(150, $false) | Out-Null
        $client.Close()
        Write-Host " [ENVIADO]" -ForegroundColor Green
    }
    catch {
        Write-Host " [OK]" -ForegroundColor Gray
    }
    Start-Sleep -Milliseconds 100
}

Start-Sleep -Milliseconds 400

Write-Host "[+] Acceso abierto. Conectando SSH y levantando túnel a localhost:$LocalTunnelPort..." -ForegroundColor Green
ssh -i "$KeyPath" -p $SSHPort -L "${LocalTunnelPort}:127.0.0.1:${RemoteAdminPort}" "${User}@${ServerIP}"
5. Reverse Proxy (NPM) y WAF/IDS (CrowdSec con Bouncer de Kernel)¿Por qué se hizo?Nginx Proxy Manager: Permite que los contenedores no expongan puertos aleatorios en la IP pública. Todo el tráfico web entra por el 80 y 443, resolviendo certificados SSL automáticamente.Aislamiento del Puerto 81: La interfaz web de NPM está expuesta solo a 127.0.0.1:81. Nadie en internet puede ver ni atacar el panel administrativo; solo se accede vía túnel SSH.CrowdSec + Bouncer en Host: CrowdSec analiza los logs de NPM en tiempo real. En lugar de procesar bloqueos dentro de Docker (que consume CPU y RAM), el bouncer inserta reglas en la cadena DOCKER-USER de iptables en el host, descartando paquetes maliciosos a nivel de kernel.Problemas encontrados y resoluciónFallo en script de instalación de repositorio: El instalador detectaba Ubuntu/resolute y se colgaba esperando dependencias.Solución: Se forzó la distribución soportada dist=noble (24.04 LTS).Crashloop de CrowdSec por colección inexistente: La variable COLLECTIONS incluía crowdsecurity/http-dos-layer7, la cual no existe en el hub (sus funciones están integradas en crowdsecurity/nginx).Solución: Se retiró del compose, estabilizando el contenedor.Mapeo modular de adquisición: Montar todo /etc/crowdsec borraba las configuraciones internas predeterminadas.Solución: Se montó únicamente el archivo de adquisición en ./acquis.yaml:/etc/crowdsec/acquis.d/npm.yaml:ro.Guía de ReplicaciónA. Desplegar los ContenedoresCrear la red compartida y la estructura de carpetas:Bashdocker network create proxy-network
mkdir -p ~/reverse-proxy/{npm/data,npm/letsencrypt,crowdsec/data}
cd ~/reverse-proxy
Crear acquis.yaml:Bashcat << 'EOF' > ~/reverse-proxy/acquis.yaml
filenames:
  - /var/log/nginx/*.log
  - /var/log/nginx/proxy-host-*_access.log
  - /var/log/nginx/proxy-host-*_error.log
labels:
  type: nginx-proxy-manager
---
filenames:
  - /var/log/nginx/fallback_*.log
  - /var/log/nginx/default-*.log
labels:
  type: nginx
EOF
Crear docker-compose.yml:Bashcat << 'EOF' > ~/reverse-proxy/docker-compose.yml
services:
  npm:
    image: 'jc21/nginx-proxy-manager:latest'
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
      - '127.0.0.1:81:81'
    environment:
      DB_SQLITE_FILE: "/data/database.sqlite"
      DISABLE_IPV6: 'true'
    volumes:
      - ./npm/data:/data
      - ./npm/letsencrypt:/etc/letsencrypt
    networks:
      - proxy-network

  crowdsec:
    image: crowdsecurity/crowdsec:latest
    container_name: crowdsec
    restart: unless-stopped
    environment:
      PGID: "1000"
      COLLECTIONS: "crowdsecurity/linux crowdsecurity/nginx crowdsecurity/nginx-proxy-manager crowdsecurity/http-cve crowdsecurity/whitelist-good-actors"
    volumes:
      - ./crowdsec/data:/var/lib/crowdsec/data
      - ./acquis.yaml:/etc/crowdsec/acquis.d/npm.yaml:ro
      - ./npm/data/logs:/var/log/nginx:ro
    ports:
      - "127.0.0.1:8080:8080"
    networks:
      - proxy-network

networks:
  proxy-network:
    external: true
EOF
Iniciar el stack:Bashsudo docker compose up -d
B. Instalar y Vincular el Firewall Bouncer en el HostGenerar la clave API en el contenedor:Bashsudo docker exec -it crowdsec cscli bouncers add host-firewall-bouncer
(Copiar la ApiKey resultante).Instalar el paquete oficial de repositorio de CrowdSec forzando release LTS de Ubuntu:Bashcurl -s [https://packagecloud.io/install/repositories/crowdsec/crowdsec/script.deb.sh](https://packagecloud.io/install/repositories/crowdsec/crowdsec/script.deb.sh) | sudo os=ubuntu dist=noble bash
sudo apt update && sudo apt install -y crowdsec-firewall-bouncer-iptables
Configurar /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml:YAMLapi_url: [http://127.0.0.1:8080/](http://127.0.0.1:8080/)
api_key: PEGA_AQUI_LA_API_KEY_OBTENIDA
iptables_chains:
  - INPUT
  - FORWARD
  - DOCKER-USER
Iniciar el bouncer:Bashsudo systemctl enable --now crowdsec-firewall-bouncer
6. Modo Sigiloso (Stealth Mode) y Anti-Escaneo en Kernel¿Por qué se hizo?Por defecto, cuando un puerto está cerrado, el kernel responde con paquetes TCP RST o ICMP Port Unreachable. Esto confirma a herramientas como Nmap o Shodan que el host está activo. Al cambiar la política a DROP silencioso y apagar las respuestas ICMP, el servidor no emite respuestas ante sondeos aleatorios.Guía de ReplicaciónSilenciar Ping e ignorar ICMP Redirects:Bashsudo tee -a /etc/sysctl.conf << 'EOF'
net.ipv4.icmp_echo_ignore_all = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
EOF
sudo sysctl -p
Establecer política de descarte silencioso en UFW:Bashsudo ufw default deny incoming
sudo ufw default allow outgoing
Filtrar escaneos de banderas TCP inválidas y crear trampa de puertos:Editar /etc/ufw/before.rules y añadir inmediatamente después de la línea -A ufw-before-input -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT:Plaintext# Descartar paquetes de conexión inválidos
-A ufw-before-input -m conntrack --ctstate INVALID -j DROP
-A ufw-before-input -p tcp ! --syn -m conntrack --ctstate NEW -j DROP

# Descartar escaneos TCP anómalos (NULL, XMAS, FIN)
-A ufw-before-input -p tcp --tcp-flags ALL NONE -j DROP
-A ufw-before-input -p tcp --tcp-flags ALL ALL -j DROP
-A ufw-before-input -p tcp --tcp-flags ALL FIN,PSH,URG -j DROP
-A ufw-before-input -p tcp --tcp-flags SYN,FIN SYN,FIN -j DROP
-A ufw-before-input -p tcp --tcp-flags SYN,RST SYN,RST -j DROP

# Trampa de escaneo de puertos (Bloqueo de 24h a quien toque puertos señuelo)
-A ufw-before-input -m recent --name PORTSCANNER --rcheck --seconds 86400 -j DROP
-A ufw-before-input -p tcp -m multiport --dports 21,23,25,135,139,445,1433,3389 -m recent --name PORTSCANNER --set -j DROP
Aplicar cambios:Bashsudo ufw reload
7. Protocolo de Verificación y Auditoría OperativaPara validar el funcionamiento del sistema en cualquier momento, ejecuta estos comandos:VerificaciónComando en Servidor / ClienteResultado EsperadoBouncer Conectadosudo docker exec -it crowdsec cscli bouncers listhost-firewall-bouncer en estado válido (✔️).Métricas de Parsingsudo docker exec -it crowdsec cscli metricsTablas con líneas leídas de fallback_http_access.log.Decisiones Activassudo docker exec -it crowdsec cscli decisions listLista de IPs actualmente bloqueadas.Reglas de Kernelsudo iptables -L DOCKER-USER -n -vReglas de CrowdSec evaluándose en la cima de la cadena.Prueba de Pingping 204.168.192.65 (desde Windows)100% paquetes perdidos (tiempo de espera agotado).Prueba de Escaneossh -p 17294 devops@204.168.192.65 (sin knock)Conexión rechazada o timeout absoluto.EOF
---

### Opción 2: Guardarlo en tu Escritorio de Windows (PowerShell)

Abre PowerShell en tu equipo local y ejecuta:

```powershell
$path = "$HOME\OneDrive\Desktop\documentacion-seguridad-vps.md"
# Si no usas OneDrive en el path, cambia a "$HOME\Desktop\documentacion-seguridad-vps.md"