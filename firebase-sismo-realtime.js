const { initializeApp } = require('firebase/app');
const { getDatabase, ref, onChildAdded, get, query, orderByChild, limitToLast } = require('firebase/database');
const fs = require('fs');
const path = require('path');

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

// Función para mostrar el último sismo
function mostrarUltimoSismo(sismo, key) {
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
}

// Función para obtener el último sismo actual
async function obtenerUltimoSismo() {
  try {
    const messagesRef = ref(database, '/messages');
    const queryRef = query(messagesRef, orderByChild('categoria'), limitToLast(1));
    
    const snapshot = await get(queryRef);
    
    if (snapshot.exists()) {
      const data = snapshot.val();
      const keys = Object.keys(data);
      
      if (keys.length > 0) {
        const lastKey = keys[0];
        const lastSismo = data[lastKey];
        
        ultimoSismo = {
          key: lastKey,
          data: lastSismo,
          timestamp: parseInt(lastSismo.categoria) || 0
        };
        
        writeToLog('✅ Último sismo cargado desde la base de datos', 'SYSTEM');
        mostrarUltimoSismo(lastSismo, lastKey);
        
        return ultimoSismo;
      }
    }
    
    writeToLog('⚠️ No se encontraron sismos en la base de datos', 'SYSTEM');
    return null;
  } catch (error) {
    writeToLog(`❌ Error obteniendo último sismo: ${error.message}`, 'ERROR');
    return null;
  }
}

// Función para escuchar nuevos sismos
function escucharNuevosSismos() {
  const messagesRef = ref(database, '/messages');
  
  writeToLog('👂 Escuchando nuevos sismos en tiempo real...', 'SYSTEM');
  writeToLog('📍 Ruta: /messages', 'SYSTEM');
  
  // Escuchar cuando se agrega un nuevo sismo
  onChildAdded(messagesRef, (snapshot) => {
    const nuevoSismo = snapshot.val();
    const key = snapshot.key;
    const timestamp = parseInt(nuevoSismo.categoria) || 0;
    
    // Verificar si es realmente un nuevo sismo (más reciente que el último)
    if (!ultimoSismo || timestamp > ultimoSismo.timestamp) {
      ultimoSismo = {
        key: key,
        data: nuevoSismo,
        timestamp: timestamp
      };
      
      writeToLog(`\n🔔 NUEVO SISMO DETECTADO!`, 'ALERT');
      mostrarUltimoSismo(nuevoSismo, key);
    } else {
      // Sismo antiguo que se está cargando inicialmente
      writeToLog(`📦 Sismo histórico cargado: ${key}`, 'INFO');
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
  
  // Obtener el último sismo actual
  await obtenerUltimoSismo();
  
  // Escuchar nuevos sismos en tiempo real
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

