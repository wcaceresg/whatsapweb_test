const { initializeApp } = require('firebase/app');
const { getDatabase, ref, onValue, onChildAdded, onChildChanged, onChildRemoved } = require('firebase/database');
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
const logFileName = `firebase-events-${new Date().toISOString().split('T')[0]}.txt`;
const logFilePath = path.join(logsDir, logFileName);

// Crear carpeta logs si no existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Función para escribir en el log
function writeToLog(message, eventType = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${eventType}] ${message}\n`;
  
  // Escribir en consola
  console.log(logEntry.trim());
  
  // Escribir en archivo (append)
  fs.appendFileSync(logFilePath, logEntry, 'utf8');
}

// Inicializar archivo de log
function initializeLog() {
  const header = `\n${'='.repeat(80)}\n`;
  const startMessage = `Firebase Listener iniciado - ${new Date().toISOString()}\n`;
  const configInfo = `Escuchando en: ${process.argv[2] || '/'}\n`;
  const logInfo = `Archivo de log: ${logFileName}\n`;
  const separator = `${'='.repeat(80)}\n\n`;
  
  fs.writeFileSync(logFilePath, header + startMessage + configInfo + logInfo + separator, 'utf8');
  console.log(`📝 Archivo de log creado: logs/${logFileName}`);
}

// Función para escuchar cambios en una ruta específica
function listenToPath(listenPath) {
  const dbRef = ref(database, listenPath);
  
  writeToLog(`Escuchando eventos en: ${listenPath}`, 'SYSTEM');
  
  // Escuchar cambios de valor
  onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    const logMessage = `VALOR ACTUALIZADO en ${listenPath}:\n${JSON.stringify(data, null, 2)}`;
    writeToLog(logMessage, 'VALUE_UPDATED');
  }, (error) => {
    const errorMessage = `Error escuchando ${listenPath}: ${error.message}`;
    writeToLog(errorMessage, 'ERROR');
  });
  
  // Escuchar cuando se agrega un nuevo hijo
  onChildAdded(dbRef, (snapshot) => {
    const data = snapshot.val();
    const key = snapshot.key;
    const logMessage = `NUEVO ELEMENTO AGREGADO en ${listenPath}/${key}:\n${JSON.stringify(data, null, 2)}`;
    writeToLog(logMessage, 'CHILD_ADDED');
  }, (error) => {
    const errorMessage = `Error escuchando nuevos elementos en ${listenPath}: ${error.message}`;
    writeToLog(errorMessage, 'ERROR');
  });
  
  // Escuchar cuando se modifica un hijo
  onChildChanged(dbRef, (snapshot) => {
    const data = snapshot.val();
    const key = snapshot.key;
    const logMessage = `ELEMENTO MODIFICADO en ${listenPath}/${key}:\n${JSON.stringify(data, null, 2)}`;
    writeToLog(logMessage, 'CHILD_CHANGED');
  }, (error) => {
    const errorMessage = `Error escuchando cambios en ${listenPath}: ${error.message}`;
    writeToLog(errorMessage, 'ERROR');
  });
  
  // Escuchar cuando se elimina un hijo
  onChildRemoved(dbRef, (snapshot) => {
    const data = snapshot.val();
    const key = snapshot.key;
    const logMessage = `ELEMENTO ELIMINADO en ${listenPath}/${key}:\n${JSON.stringify(data, null, 2)}`;
    writeToLog(logMessage, 'CHILD_REMOVED');
  }, (error) => {
    const errorMessage = `Error escuchando eliminaciones en ${listenPath}: ${error.message}`;
    writeToLog(errorMessage, 'ERROR');
  });
}

// Función principal
function main() {
  // Inicializar archivo de log
  initializeLog();
  
  writeToLog('🚀 Iniciando Firebase Listener...', 'SYSTEM');
  writeToLog('📡 Conectado a Firebase Realtime Database', 'SYSTEM');
  writeToLog('💡 Presiona Ctrl+C para detener', 'SYSTEM');
  
  // Escuchar en la raíz de la base de datos
  // Puedes cambiar '/' por la ruta específica que desees escuchar
  const pathToListen = process.argv[2] || '/';
  
  listenToPath(pathToListen);
  
  // Mantener el proceso activo
  process.on('SIGINT', () => {
    writeToLog('\n👋 Deteniendo Firebase Listener...', 'SYSTEM');
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

