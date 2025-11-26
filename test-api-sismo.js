const fetch = require('node-fetch');

// Configuración
let API_ENDPOINT = process.env.API_ENDPOINT || 'http://127.0.0.1:9090/test-sismo-realtime';
const DEFAULT_PHONE_NUMBER = process.env.PHONE_NUMBER || '51997377840';
const HTTP_TIMEOUT = 10000; // 10 segundos

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Función para formatear mensaje de sismo de prueba
function formatearMensajeSismoPrueba() {
  return `🌍 *NUEVO SISMO DETECTADO*

📋 *Reporte:* SISMO PRUEBA
📅 *Fecha UTC:* ${new Date().toISOString().split('T')[0]}
🕐 *Hora UTC:* ${new Date().toISOString().split('T')[1].split('.')[0]}Z
📊 *Magnitud:* 5.2
📍 *Ubicación:* Lima, Perú
🌐 *Coordenadas:* Lat -12.0464, Lon -77.0428
⬇️ *Profundidad:* 35 km
💥 *Intensidad:* IV
🏷️ *Tipo:* Sismo
🆔 *ID:* TEST-${Date.now()}`;
}

// Función para enviar mensaje a la API
async function enviarMensaje(number, message) {
  const payload = {
    number: number,
    message: message
  };

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}📤 Enviando petición a:${colors.reset} ${API_ENDPOINT}`);
  console.log(`${colors.bright}${colors.blue}📱 Número:${colors.reset} ${number}`);
  console.log(`${colors.bright}${colors.blue}📝 Payload:${colors.reset}`);
  console.log(JSON.stringify(payload, null, 2));
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  try {
    // Crear un AbortController para manejar el timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT);

    const startTime = Date.now();

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
      const endTime = Date.now();
      const duration = endTime - startTime;

      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (response.ok) {
        console.log(`${colors.green}✅ Petición exitosa!${colors.reset}`);
        console.log(`${colors.bright}Status:${colors.reset} ${response.status} ${response.statusText}`);
        console.log(`${colors.bright}Tiempo de respuesta:${colors.reset} ${duration}ms`);
        console.log(`${colors.bright}Respuesta:${colors.reset}`);
        console.log(typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2));
        return { success: true, response: responseData, status: response.status };
      } else {
        console.log(`${colors.red}❌ Error en la respuesta${colors.reset}`);
        console.log(`${colors.bright}Status:${colors.reset} ${response.status} ${response.statusText}`);
        console.log(`${colors.bright}Respuesta:${colors.reset}`);
        console.log(typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2));
        return { success: false, response: responseData, status: response.status };
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.log(`${colors.red}⏱️ Timeout: El servidor no respondió en ${HTTP_TIMEOUT}ms${colors.reset}`);
        console.log(`${colors.yellow}💡 Verifica que el servidor esté corriendo en ${API_ENDPOINT}${colors.reset}`);
        return { success: false, error: 'Timeout', message: fetchError.message };
      } else if (fetchError.code === 'ECONNREFUSED') {
        console.log(`${colors.red}❌ Conexión rechazada${colors.reset}`);
        console.log(`${colors.yellow}💡 El servidor no está disponible en ${API_ENDPOINT}${colors.reset}`);
        console.log(`${colors.yellow}💡 Verifica que el servidor esté corriendo en el puerto 9090${colors.reset}`);
        console.log(`${colors.yellow}💡 Error: ${fetchError.message}${colors.reset}`);
        return { success: false, error: 'Connection refused', message: fetchError.message };
      } else {
        throw fetchError;
      }
    }
  } catch (error) {
    console.log(`${colors.red}❌ Error inesperado:${colors.reset} ${error.message}`);
    if (error.stack) {
      console.log(`${colors.red}Stack:${colors.reset} ${error.stack}`);
    }
    return { success: false, error: error.name, message: error.message };
  }
}

// Función principal
async function main() {
  console.log(`${colors.bright}${colors.cyan}╔══════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║                    TEST API SISMO REALTIME                                    ║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚══════════════════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  // Obtener argumentos de la línea de comandos
  const args = process.argv.slice(2);
  
  let number = DEFAULT_PHONE_NUMBER;
  let message = null;
  let count = 1;
  let delay = 0;

  // Parsear argumentos
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--number':
      case '-n':
        number = args[++i];
        break;
      case '--message':
      case '-m':
        message = args[++i];
        break;
      case '--count':
      case '-c':
        count = parseInt(args[++i]) || 1;
        break;
      case '--delay':
      case '-d':
        delay = parseInt(args[++i]) || 0;
        break;
      case '--endpoint':
      case '-e':
        API_ENDPOINT = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`${colors.bright}Uso:${colors.reset}`);
        console.log(`  node test-api-sismo.js [opciones]\n`);
        console.log(`${colors.bright}Opciones:${colors.reset}`);
        console.log(`  -n, --number <número>     Número de teléfono (default: ${DEFAULT_PHONE_NUMBER})`);
        console.log(`  -m, --message <mensaje>    Mensaje personalizado (default: mensaje de sismo de prueba)`);
        console.log(`  -c, --count <número>       Número de peticiones a enviar (default: 1)`);
        console.log(`  -d, --delay <ms>           Delay entre peticiones en milisegundos (default: 0)`);
        console.log(`  -e, --endpoint <url>      URL del endpoint (default: ${API_ENDPOINT})`);
        console.log(`  -h, --help                Mostrar esta ayuda\n`);
        console.log(`${colors.bright}Ejemplos:${colors.reset}`);
        console.log(`  node test-api-sismo.js`);
        console.log(`  node test-api-sismo.js --number 51997377840 --message "Mensaje de prueba"`);
        console.log(`  node test-api-sismo.js --count 5 --delay 1000`);
        console.log(`  node test-api-sismo.js --endpoint http://localhost:9090/test-sismo-realtime\n`);
        process.exit(0);
        break;
    }
  }

  // Si no se proporciona mensaje, usar el mensaje de sismo de prueba
  if (!message) {
    message = formatearMensajeSismoPrueba();
  }

  console.log(`${colors.bright}Configuración:${colors.reset}`);
  console.log(`  Endpoint: ${API_ENDPOINT}`);
  console.log(`  Número: ${number}`);
  console.log(`  Peticiones: ${count}`);
  if (delay > 0) {
    console.log(`  Delay entre peticiones: ${delay}ms`);
  }
  console.log('');

  // Enviar peticiones
  const results = [];
  for (let i = 0; i < count; i++) {
    if (count > 1) {
      console.log(`${colors.bright}${colors.cyan}[Petición ${i + 1}/${count}]${colors.reset}\n`);
    }

    const result = await enviarMensaje(number, message);
    results.push(result);

    // Si hay delay y no es la última petición, esperar
    if (delay > 0 && i < count - 1) {
      console.log(`${colors.yellow}⏳ Esperando ${delay}ms antes de la siguiente petición...${colors.reset}\n`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    if (i < count - 1) {
      console.log(''); // Línea en blanco entre peticiones
    }
  }

  // Resumen final
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}📊 RESUMEN${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`  Total de peticiones: ${results.length}`);
  console.log(`  ${colors.green}✅ Exitosas: ${successful}${colors.reset}`);
  console.log(`  ${colors.red}❌ Fallidas: ${failed}${colors.reset}`);
  
  if (failed > 0) {
    console.log(`\n${colors.yellow}💡 Si todas las peticiones fallaron, verifica:${colors.reset}`);
    console.log(`  1. Que el servidor esté corriendo en ${API_ENDPOINT}`);
    console.log(`  2. Que el puerto 9090 esté disponible`);
    console.log(`  3. Que el endpoint sea correcto`);
  }
  
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  // Salir con código de error si hubo fallos
  process.exit(failed > 0 ? 1 : 0);
}

// Ejecutar
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}Error fatal:${colors.reset}`, error);
    process.exit(1);
  });
}

module.exports = { enviarMensaje, formatearMensajeSismoPrueba };

