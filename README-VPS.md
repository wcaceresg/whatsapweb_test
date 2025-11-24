# Configuración para VPS

## Instalación de Dependencias

### 1. Instalar dependencias del sistema

Ejecuta el script de instalación:

```bash
sudo bash install-vps-dependencies.sh
```

O instala manualmente las dependencias necesarias para Chromium.

### 2. Instalar dependencias de Node.js

```bash
npm install
```

## Configuración

### Variables de Entorno

Asegúrate de que el archivo `.env` o la configuración de tu aplicación PHP tenga:

```env
URL_API_WHATSAPP=http://tu-vps-ip:9090
```

O si usas un dominio:

```env
URL_API_WHATSAPP=http://tu-dominio.com:9090
```

## Ejecución

### Opción 1: Ejecutar directamente (no recomendado para producción)

```bash
node test.js
```

### Opción 2: Usar PM2 (Recomendado para producción)

1. Instalar PM2 globalmente:
```bash
npm install -g pm2
```

2. Iniciar la aplicación:
```bash
pm2 start test.js --name whatsapp-bot
```

3. Configurar PM2 para iniciar al arrancar el sistema:
```bash
pm2 startup
pm2 save
```

4. Ver logs:
```bash
pm2 logs whatsapp-bot
```

5. Reiniciar la aplicación:
```bash
pm2 restart whatsapp-bot
```

### Opción 3: Usar systemd (Alternativa a PM2)

Crear un archivo de servicio `/etc/systemd/system/whatsapp-bot.service`:

```ini
[Unit]
Description=WhatsApp Bot Service
After=network.target

[Service]
Type=simple
User=tu-usuario
WorkingDirectory=/var/www/whatsapweb_test
ExecStart=/usr/bin/node /var/www/whatsapweb_test/test.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=whatsapp-bot

[Install]
WantedBy=multi-user.target
```

Luego:
```bash
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-bot
sudo systemctl start whatsapp-bot
sudo systemctl status whatsapp-bot
```

## Configuración de Firewall

Asegúrate de abrir el puerto 9090:

```bash
# UFW
sudo ufw allow 9090/tcp

# O con iptables
sudo iptables -A INPUT -p tcp --dport 9090 -j ACCEPT
```

## Verificación

1. Verifica que el servicio esté corriendo:
```bash
# Con PM2
pm2 status

# Con systemd
sudo systemctl status whatsapp-bot
```

2. Verifica que el puerto esté escuchando:
```bash
netstat -tulpn | grep 9090
# O
ss -tulpn | grep 9090
```

3. Prueba la API:
```bash
curl http://localhost:9090/
```

## Solución de Problemas

### Error: "Failed to launch the browser process"

- Asegúrate de haber instalado todas las dependencias del sistema
- Verifica que el usuario tenga permisos suficientes
- Si ejecutas como root, el código ya incluye `--no-sandbox`

### Error: "Cannot find module"

- Ejecuta `npm install` en el directorio del proyecto

### El cliente no se conecta

- Verifica que la sesión esté guardada en `.wwebjs_auth/session-client-one/`
- Si no hay sesión, accede a `http://tu-vps:9090/qr` para escanear el QR
- Revisa los logs para ver el estado de la conexión

## Notas de Seguridad

⚠️ **IMPORTANTE**: 

- No ejecutes la aplicación como root en producción
- Usa un usuario dedicado para la aplicación
- Configura un firewall adecuado
- Considera usar un proxy reverso (nginx) con SSL/TLS
- No expongas el puerto directamente si no es necesario

## Ejemplo de configuración con Nginx (Opcional)

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:9090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```


