#!/bin/bash

# Script para instalar dependencias necesarias para Puppeteer en VPS Linux
# Ejecutar como: sudo bash install-vps-dependencies.sh

echo "🔧 Instalando dependencias para Puppeteer en VPS..."

# Actualizar sistema
apt-get update

# Instalar dependencias necesarias para Chromium/Chrome
apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

echo "✅ Dependencias instaladas correctamente"
echo ""
echo "📝 Notas importantes:"
echo "1. Si ejecutas como root, el código ya incluye --no-sandbox"
echo "2. Es recomendable ejecutar la aplicación con un usuario no-root"
echo "3. Si usas PM2, asegúrate de configurarlo correctamente"


