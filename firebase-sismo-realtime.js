const { initializeApp } = require('firebase/app');
const { getDatabase, ref, onChildAdded, get, query, orderByChild, limitToLast } = require('firebase/database');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Configuración de Firebase
const config = {
  apiKey: "AIzaSyBJYSQajmpt6bOIVD26lKBoyABSu3SoglU",
  authDomain: "igpsismos22.firebaseapp.com",
  databaseURL: "https://igpsismos22-default-rtdb.firebaseio.com",
  projectId: "igpsismos22",
  storageBucket: "igpsismos22.firebasestorage.app",
  messagingSenderId: "649137774512",
  appId: "1:542582498809:web:f8aacf2b9ae51f27f20928"
};

// Inicializar Firebase
const app = initializeApp(config);
const database = getDatabase(app);

// Configuración del log
const logsDir = path.join(__dirname, 'logs');
const logFileName = `sismos-realtime-${new Date().toISOString().split('T')[0]}.txt`;
const logFilePath = path.join(logsDir, logFileName);

// Crear carpeta logs si no existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Variable para almacenar el último sismo
let ultimoSismo = null;
// Bandera para saber si ya terminó de cargar el historial inicial
let historialCargado = false;

// Configuración del endpoint para enviar sismos
// Usar 127.0.0.1 en lugar de localhost para evitar problemas con IPv6
const API_ENDPOINT = process.env.API_ENDPOINT || 'http://127.0.0.1:9090/test-sismo-realtime';
const DEFAULT_PHONE_NUMBER = '51997377840'; // Puedes cambiar esto o hacerlo configurable
const HTTP_TIMEOUT = 5000; // Timeout de 5 segundos para las peticiones HTTP

// Función para escribir en el log
function writeToLog(message, eventType = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${eventType}] ${message}\n`;
  
  // Escribir en consola
  console.log(logEntry.trim());
  
  // Escribir en archivo (append)
  fs.appendFileSync(logFilePath, logEntry, 'utf8');
}

// Función para formatear información del sismo
function formatearSismo(sismo, key) {
  if (!sismo) return null;
  
  return {
    id: key,
    reporte: sismo.reporte || 'N/A',
    fecha: sismo.fechautc || 'N/A',
    hora: sismo.horautc || 'N/A',
    magnitud: sismo.magnitud || 'N/A',
    profundidad: sismo.profundidad || 'N/A',
    latitud: sismo.lat || 'N/A',
    longitud: sismo.lon || 'N/A',
    referencia: sismo.referencia || 'N/A',
    intensidad: sismo.intenso || 'N/A',
    categoria: sismo.categoria || 'N/A',
    tipoReporte: sismo.tiporeporte || 'N/A',
    simulacro: sismo.simulacro || '0'
  };
}

// Función para formatear el mensaje del sismo para WhatsApp
function formatearMensajeSismo(sismoFormateado) {
  return `🌍 *NUEVO SISMO DETECTADO*

📋 *Reporte:* ${sismoFormateado.reporte}
📅 *Fecha UTC:* ${sismoFormateado.fecha}
🕐 *Hora UTC:* ${sismoFormateado.hora}
📊 *Magnitud:* ${sismoFormateado.magnitud}
📍 *Ubicación:* ${sismoFormateado.referencia}
🌐 *Coordenadas:* Lat ${sismoFormateado.latitud}, Lon ${sismoFormateado.longitud}
⬇️ *Profundidad:* ${sismoFormateado.profundidad} km
💥 *Intensidad:* ${sismoFormateado.intensidad}
🏷️ *Tipo:* ${sismoFormateado.tipoReporte}
🆔 *ID:* ${sismoFormateado.id}`;
}

// Función para enviar el sismo al endpoint
async function enviarSismoAlEndpoint(sismoFormateado, esNuevo = false) {
  // Solo enviar si es un sismo nuevo en tiempo real
  if (!esNuevo) {
    return;
  }
  
  try {
    const mensaje = formatearMensajeSismo(sismoFormateado);
    
    const payload = {
      number: DEFAULT_PHONE_NUMBER,
      message: mensaje
    };
    
    writeToLog(`📤 Enviando sismo al endpoint: ${API_ENDPOINT}`, 'HTTP');
    
    // Crear un AbortController para manejar el timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT);
    
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const responseData = await response.text();
        writeToLog(`✅ Sismo enviado exitosamente. Respuesta: ${responseData}`, 'HTTP_SUCCESS');
      } else {
        const errorText = await response.text();
        writeToLog(`❌ Error al enviar sismo. Status: ${response.status}, Respuesta: ${errorText}`, 'HTTP_ERROR');
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Manejar diferentes tipos de errores
      if (fetchError.name === 'AbortError') {
        writeToLog(`⏱️ Timeout al enviar sismo al endpoint (${HTTP_TIMEOUT}ms). El servidor no respondió a tiempo.`, 'HTTP_ERROR');
        writeToLog(`💡 Verifica que el servidor esté corriendo en ${API_ENDPOINT}`, 'HTTP_ERROR');
      } else if (fetchError.code === 'ECONNREFUSED') {
        writeToLog(`❌ Conexión rechazada al endpoint: ${API_ENDPOINT}`, 'HTTP_ERROR');
        writeToLog(`💡 El servidor no está disponible. Verifica que esté corriendo en el puerto 9090`, 'HTTP_ERROR');
        writeToLog(`💡 Error detallado: ${fetchError.message}`, 'HTTP_ERROR');
      } else {
        throw fetchError; // Re-lanzar otros errores para que sean manejados por el catch externo
      }
    }
  } catch (error) {
    writeToLog(`❌ Error inesperado al enviar sismo al endpoint: ${error.message}`, 'HTTP_ERROR');
    if (error.stack) {
      writeToLog(`Stack: ${error.stack}`, 'HTTP_ERROR');
    }
  }
}

// Función para mostrar el último sismo
function mostrarUltimoSismo(sismo, key, esNuevo = false) {
  const sismoFormateado = formatearSismo(sismo, key);
  
  if (!sismoFormateado) {
    writeToLog('Error: No se pudo formatear el sismo', 'ERROR');
    return;
  }
  
  const separador = '='.repeat(80);
  const mensaje = `
${separador}
🌍 ÚLTIMO SISMO DETECTADO - TIEMPO REAL
${separador}
📋 Reporte: ${sismoFormateado.reporte}
📅 Fecha UTC: ${sismoFormateado.fecha}
🕐 Hora UTC: ${sismoFormateado.hora}
📊 Magnitud: ${sismoFormateado.magnitud}
📍 Ubicación: ${sismoFormateado.referencia}
🌐 Coordenadas: Lat ${sismoFormateado.latitud}, Lon ${sismoFormateado.longitud}
⬇️  Profundidad: ${sismoFormateado.profundidad} km
💥 Intensidad: ${sismoFormateado.intensidad}
🏷️  Tipo: ${sismoFormateado.tipoReporte}
🆔 ID: ${sismoFormateado.id}
⏰ Timestamp: ${sismoFormateado.categoria}
${separador}
`;
  
  writeToLog(mensaje, 'NUEVO_SISMO');
  
  // Guardar también en formato JSON para fácil procesamiento
  const jsonData = JSON.stringify(sismoFormateado, null, 2);
  writeToLog(`\nDatos completos del sismo (JSON):\n${jsonData}\n`, 'SISMO_JSON');
  
  // Enviar al endpoint si es un sismo nuevo
  if (esNuevo) {
    enviarSismoAlEndpoint(sismoFormateado, true);
  }
}

// Función para obtener el último sismo actual y cargar historial
async function cargarHistorialYUltimoSismo() {
  try {
    const messagesRef = ref(database, '/messages');
    
    writeToLog('📥 Cargando historial de sismos...', 'SYSTEM');
    
    // Obtener todos los sismos para encontrar el último
    const snapshot = await get(messagesRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const keys = Object.keys(data);
      
      if (keys.length > 0) {
        // Encontrar el sismo con el timestamp más reciente
        let maxTimestamp = 0;
        let ultimoKey = null;
        let ultimoData = null;
        
        for (const key of keys) {
          const sismo = data[key];
          const timestamp = parseInt(sismo.categoria) || 0;
          
          if (timestamp > maxTimestamp) {
            maxTimestamp = timestamp;
            ultimoKey = key;
            ultimoData = sismo;
          }
        }
        
        if (ultimoKey && ultimoData) {
          ultimoSismo = {
            key: ultimoKey,
            data: ultimoData,
            timestamp: maxTimestamp
          };
          
          writeToLog(`✅ Historial cargado: ${keys.length} sismos encontrados`, 'SYSTEM');
          writeToLog(`📊 Último sismo del historial:`, 'SYSTEM');
          mostrarUltimoSismo(ultimoData, ultimoKey, false); // false = no es nuevo, es del historial
          
          return ultimoSismo;
        }
      }
    }
    
    writeToLog('⚠️ No se encontraron sismos en la base de datos', 'SYSTEM');
    return null;
  } catch (error) {
    writeToLog(`❌ Error cargando historial: ${error.message}`, 'ERROR');
    return null;
  }
}

// Función para escuchar nuevos sismos
function escucharNuevosSismos() {
  const messagesRef = ref(database, '/messages');
  
  writeToLog('👂 Configurando listener para nuevos sismos en tiempo real...', 'SYSTEM');
  writeToLog('📍 Ruta: /messages', 'SYSTEM');
  
  // Guardar el timestamp del último sismo ANTES de iniciar el listener
  // Esto nos permite distinguir entre sismos históricos y nuevos
  const timestampUltimoSismoInicial = ultimoSismo ? ultimoSismo.timestamp : 0;
  
  // Timestamp del momento en que se inicia el listener
  const tiempoInicioListener = Date.now();
  // Contador para rastrear cuántos sismos históricos se han recibido
  let sismosHistoricosRecibidos = 0;
  
  // Usar un timeout razonable para marcar cuando probablemente terminó la carga inicial
  // Firebase generalmente carga el historial en los primeros segundos
  setTimeout(() => {
    if (!historialCargado) {
      historialCargado = true;
      writeToLog(`✅ Período de carga inicial completado (${sismosHistoricosRecibidos} sismos históricos procesados)`, 'SYSTEM');
      writeToLog('🔔 Ahora escuchando SOLO sismos nuevos en tiempo real...', 'SYSTEM');
      writeToLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'SYSTEM');
    }
  }, 3000); // 3 segundos debería ser suficiente para cargar el historial
  
  // Escuchar cuando se agrega un nuevo sismo
  onChildAdded(messagesRef, (snapshot) => {
    const nuevoSismo = snapshot.val();
    const key = snapshot.key;
    const timestamp = parseInt(nuevoSismo.categoria) || 0;
    
    // Calcular el tiempo transcurrido desde que se inició el listener
    const tiempoTranscurrido = Date.now() - tiempoInicioListener;
    
    // Si el historial ya fue cargado, este es definitivamente un sismo nuevo
    if (historialCargado) {
      // Verificar que sea más reciente que el último conocido
      if (timestamp > ultimoSismo.timestamp) {
        ultimoSismo = {
          key: key,
          data: nuevoSismo,
          timestamp: timestamp
        };
        
        writeToLog(`\n🔔 NUEVO SISMO DETECTADO EN TIEMPO REAL!`, 'ALERT');
        mostrarUltimoSismo(nuevoSismo, key, true); // true = es nuevo en tiempo real
      } else {
        writeToLog(`⚠️ Sismo recibido con timestamp menor al último conocido: ${key}`, 'WARNING');
      }
    } else {
      // Aún en período de carga inicial
      sismosHistoricosRecibidos++;
      
      // Si este sismo es más reciente que el último que teníamos ANTES de iniciar el listener,
      // probablemente es un sismo nuevo que llegó durante la carga
      if (timestamp > timestampUltimoSismoInicial) {
        // Verificar si han pasado al menos 1 segundo desde el inicio del listener
        // para evitar falsos positivos al inicio
        if (tiempoTranscurrido > 1000) {
          historialCargado = true;
          ultimoSismo = {
            key: key,
            data: nuevoSismo,
            timestamp: timestamp
          };
          writeToLog(`\n🔔 NUEVO SISMO DETECTADO (durante carga inicial)!`, 'ALERT');
          mostrarUltimoSismo(nuevoSismo, key, true); // true = es nuevo en tiempo real
          writeToLog('🔔 Ahora escuchando SOLO sismos nuevos en tiempo real...', 'SYSTEM');
          writeToLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'SYSTEM');
        } else {
          // Actualizar el último sismo pero aún estamos en carga inicial
          if (!ultimoSismo || timestamp > ultimoSismo.timestamp) {
            ultimoSismo = {
              key: key,
              data: nuevoSismo,
              timestamp: timestamp
            };
          }
        }
      } else {
        // Sismo histórico, solo actualizar si es más reciente
        if (!ultimoSismo || timestamp > ultimoSismo.timestamp) {
          ultimoSismo = {
            key: key,
            data: nuevoSismo,
            timestamp: timestamp
          };
        }
      }
    }
  }, (error) => {
    writeToLog(`❌ Error escuchando nuevos sismos: ${error.message}`, 'ERROR');
  });
}

// Inicializar archivo de log
function initializeLog() {
  const header = `\n${'='.repeat(80)}\n`;
  const startMessage = `Firebase Sismo Realtime Listener iniciado - ${new Date().toISOString()}\n`;
  const separator = `${'='.repeat(80)}\n\n`;
  
  fs.writeFileSync(logFilePath, header + startMessage + separator, 'utf8');
  console.log(`📝 Archivo de log creado: logs/${logFileName}`);
}

// Función principal
async function main() {
  // Inicializar archivo de log
  initializeLog();
  
  writeToLog('🚀 Iniciando Firebase Sismo Realtime Listener...', 'SYSTEM');
  writeToLog('📡 Conectado a Firebase Realtime Database', 'SYSTEM');
  writeToLog('💡 Presiona Ctrl+C para detener\n', 'SYSTEM');
  
  // Cargar historial y obtener el último sismo
  await cargarHistorialYUltimoSismo();
  
  // Escuchar nuevos sismos en tiempo real
  // Nota: onChildAdded se disparará para todos los hijos existentes primero
  // pero solo alertaremos después de que termine la carga inicial
  escucharNuevosSismos();
  
  // Mantener el proceso activo
  process.on('SIGINT', () => {
    writeToLog('\n👋 Deteniendo Firebase Sismo Listener...', 'SYSTEM');
    if (ultimoSismo) {
      writeToLog(`📊 Último sismo registrado: ${ultimoSismo.key}`, 'SYSTEM');
    }
    writeToLog('Listener detenido correctamente', 'SYSTEM');
    process.exit(0);
  });
  
  // Manejar errores no capturados
  process.on('uncaughtException', (error) => {
    writeToLog(`Error no capturado: ${error.message}\n${error.stack}`, 'ERROR');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    writeToLog(`Promesa rechazada no manejada: ${reason}`, 'ERROR');
  });
}

// Ejecutar
main();

