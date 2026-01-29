const { Client, Location, Poll, List, Buttons, LocalAuth, MessageMedia } = require('./index');
const qrcode = require('qrcode-terminal');
const qr = require('qr-image');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const mime = require('mime');
const app = express();

// Configurar multer para manejar archivos en memoria
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB límite
    }
});
/*const client = new Client({
    authStrategy: new LocalAuth(),
    // proxyAuthentication: { username: 'username', password: 'password' },

    // deviceName: 'Your custom name',

    // browserName: 'Firefox',
    puppeteer: { 
        // args: ['--proxy-server=proxy-server-that-requires-authentication.example.com'],
        headless: false,
    },
    // pairWithPhoneNumber: {
    //     phoneNumber: '96170100100' // Pair with phone number (format: <COUNTRY_CODE><PHONE_NUMBER>)
    //     showNotification: true,
    //     intervalMs: 180000 // Time to renew pairing code in milliseconds, defaults to 3 minutes
    // }
});*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: '*',
    methods: ['POST', 'PUT', 'GET', 'OPTIONS', 'HEAD'],
    credentials: true, // enable set cookie
    exposedHeaders: ['set-cookie'] // enable set cookie
}));

app.use(session({ 
    secret: 'SECRET',
      saveUninitialized: true,
      resave: false,
      cookie:{
        //secure: false,
        maxAge: 100000,
      }
     }));

// Verificar si existe sesión guardada
const path = require('path');
const sessionPath = path.join(__dirname, '.wwebjs_auth', 'session-client-one');
const sessionExists = fs.existsSync(sessionPath);

// Limpiar SingletonLock si existe (evita errores al reiniciar)
const singletonLockPath = path.join(sessionPath, 'SingletonLock');
if (fs.existsSync(singletonLockPath)) {
    try {
        fs.unlinkSync(singletonLockPath);
        console.log('🧹 Archivo SingletonLock limpiado (proceso anterior no cerrado correctamente)');
    } catch (err) {
        console.warn('⚠️ No se pudo eliminar SingletonLock:', err.message);
    }
}

if (sessionExists) {
    console.log('✅ Sesión encontrada. Restaurando sesión guardada...');
} else {
    console.log('⚠️ No se encontró sesión guardada. Se solicitará escanear el QR.');
}

const client = new Client({
    authStrategy: new LocalAuth({
      clientId: "client-one"
    }),
    puppeteer: {
      // Configuración para servidor Linux/VPS
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      // Si tienes Chrome/Chromium instalado en el sistema, descomenta y ajusta la ruta:
      // executablePath: '/usr/bin/chromium-browser',
       //setChromePath('/usr/bin/google-chrome-stable'); //
      // O si tienes Google Chrome:
       //executablePath: '/usr/bin/google-chrome-stable',
       executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      // Si no especificas executablePath, Puppeteer usará el Chromium que viene con él
    }
  });

// Variable para rastrear si el cliente está listo
let isClientReady = false;

// client initialize does not finish at ready now.
console.log('🔄 Inicializando cliente de WhatsApp...');
client.initialize();

client.on('loading_screen', (percent, message) => {
    console.log('LOADING SCREEN', percent, message);
});

client.on('qr', async (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    console.log('📱 QR RECEIVED - Escanea este código QR con WhatsApp');
    qrcode.generate(qr, { small: true });
    generateImage(qr);
});

client.on('code', (code) => {
    console.log('Pairing code:',code);
});

client.on('authenticated', () => {
    console.log('✅ AUTHENTICATED - Sesión autenticada correctamente');
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessful
    console.error('❌ AUTHENTICATION FAILURE', msg);
    console.log('💡 La sesión guardada no es válida. Se solicitará un nuevo QR.');
});

client.on('ready', async () => {
    console.log('✅ READY - Cliente de WhatsApp listo y conectado!');
    isClientReady = true; // Marcar el cliente como listo
    if (sessionExists) {
        console.log('✅ Sesión restaurada exitosamente desde:', sessionPath);
    }
    
    // Intentar obtener la versión de WhatsApp Web con manejo de errores
    try {
        const debugWWebVersion = await client.getWWebVersion();
        console.log(`WWebVersion = ${debugWWebVersion}`);
    } catch (error) {
        // Este error puede ocurrir si el contexto de ejecución se destruye durante la navegación
        // No es crítico, el cliente sigue funcionando
        if (error.message && error.message.includes('Execution context was destroyed')) {
            console.log('⚠️ No se pudo obtener la versión de WhatsApp Web (contexto destruido durante navegación)');
            console.log('💡 Esto es normal durante la inicialización. El cliente sigue funcionando correctamente.');
        } else {
            console.warn('⚠️ Error al obtener versión de WhatsApp Web:', error.message);
        }
    }

    // Configurar manejadores de errores de página solo si la página existe
    try {
        if (client.pupPage) {
            client.pupPage.on('pageerror', function(err) {
                console.log('Page error: ' + err.toString());
            });
            client.pupPage.on('error', function(err) {
                console.log('Page error: ' + err.toString());
            });
        }
    } catch (error) {
        console.warn('⚠️ No se pudieron configurar los manejadores de errores de página:', error.message);
    }
    
});

client.on('disconnected', (reason) => {
    console.log('❌ Client was logged out', reason);
    isClientReady = false; // Marcar el cliente como no listo
});

client.on('message', async msg => {
    console.log('MESSAGE RECEIVED', msg);

    
});

client.on('message_create', async (msg) => {
    // Fired on all message creations, including your own
    if (msg.fromMe) {
        // do stuff here
    }

    // Unpins a message
    if (msg.fromMe && msg.body.startsWith('!unpin')) {
        const pinnedMsg = await msg.getQuotedMessage();
        if (pinnedMsg) {
            // Will unpin a message
            const result = await pinnedMsg.unpin();
            console.log(result); // True if the operation completed successfully, false otherwise
        }
    }
});

client.on('message_ciphertext', (msg) => {
    // Receiving new incoming messages that have been encrypted
    // msg.type === 'ciphertext'
    msg.body = 'Waiting for this message. Check your phone.';
    
    // do stuff here
});

client.on('message_revoke_everyone', async (after, before) => {
    // Fired whenever a message is deleted by anyone (including you)
    console.log(after); // message after it was deleted.
    if (before) {
        console.log(before); // message before it was deleted.
    }
});

client.on('message_revoke_me', async (msg) => {
    // Fired whenever a message is only deleted in your own view.
    console.log(msg.body); // message before it was deleted.
});

client.on('message_ack', (msg, ack) => {
    /*
        == ACK VALUES ==
        ACK_ERROR: -1
        ACK_PENDING: 0
        ACK_SERVER: 1
        ACK_DEVICE: 2
        ACK_READ: 3
        ACK_PLAYED: 4
    */

    if (ack == 3) {
        // The message was read
    }
});

client.on('group_join', (notification) => {
    // User has joined or been added to the group.
    console.log('join', notification);
    //notification.reply('User joined.');
});

client.on('group_leave', (notification) => {
    // User has left or been kicked from the group.
    console.log('leave', notification);
    //notification.reply('User left.');
});

client.on('group_update', (notification) => {
    // Group picture, subject or description has been updated.
    console.log('update', notification);
});

client.on('change_state', state => {
    console.log('🔄 CHANGE STATE:', state);
    if (state === 'CONNECTING') {
        console.log('📡 Conectando con WhatsApp...');
    } else if (state === 'OPENING') {
        console.log('🔓 Abriendo sesión...');
    } else if (state === 'PAIRING') {
        console.log('🔗 Emparejando dispositivo...');
    }
});

// Change to false if you don't want to reject incoming calls
let rejectCalls = true;

client.on('call', async (call) => {
    console.log('Call received, rejecting. GOTO Line 261 to disable', call);
    if (rejectCalls) await call.reject();
    //await client.sendMessage(call.from, `[${call.fromMe ? 'Outgoing' : 'Incoming'}] Phone call from ${call.from}, type ${call.isGroup ? 'group' : ''} ${call.isVideo ? 'video' : 'audio'} call. ${rejectCalls ? 'This call was automatically rejected by the script.' : ''}`);
});


client.on('contact_changed', async (message, oldId, newId, isContact) => {
    /** The time the event occurred. */
    const eventTime = (new Date(message.timestamp * 1000)).toLocaleString();

    console.log(
        `The contact ${oldId.slice(0, -5)}` +
        `${!isContact ? ' that participates in group ' +
            `${(await client.getChatById(message.to ?? message.from)).name} ` : ' '}` +
        `changed their phone number\nat ${eventTime}.\n` +
        `Their new phone number is ${newId.slice(0, -5)}.\n`);

    /**
     * Information about the @param {message}:
     * 
     * 1. If a notification was emitted due to a group participant changing their phone number:
     * @param {message.author} is a participant's id before the change.
     * @param {message.recipients[0]} is a participant's id after the change (a new one).
     * 
     * 1.1 If the contact who changed their number WAS in the current user's contact list at the time of the change:
     * @param {message.to} is a group chat id the event was emitted in.
     * @param {message.from} is a current user's id that got an notification message in the group.
     * Also the @param {message.fromMe} is TRUE.
     * 
     * 1.2 Otherwise:
     * @param {message.from} is a group chat id the event was emitted in.
     * @param {message.to} is @type {undefined}.
     * Also @param {message.fromMe} is FALSE.
     * 
     * 2. If a notification was emitted due to a contact changing their phone number:
     * @param {message.templateParams} is an array of two user's ids:
     * the old (before the change) and a new one, stored in alphabetical order.
     * @param {message.from} is a current user's id that has a chat with a user,
     * whos phone number was changed.
     * @param {message.to} is a user's id (after the change), the current user has a chat with.
     */
});

client.on('group_admin_changed', (notification) => {
    if (notification.type === 'promote') {
        /** 
          * Emitted when a current user is promoted to an admin.
          * {@link notification.author} is a user who performs the action of promoting/demoting the current user.
          */
        console.log(`You were promoted by ${notification.author}`);
    } else if (notification.type === 'demote')
        /** Emitted when a current user is demoted to a regular user. */
        console.log(`You were demoted by ${notification.author}`);
});

client.on('group_membership_request', async (notification) => {
    /**
     * The example of the {@link notification} output:
     * {
     *     id: {
     *         fromMe: false,
     *         remote: 'groupId@g.us',
     *         id: '123123123132132132',
     *         participant: 'number@c.us',
     *         _serialized: 'false_groupId@g.us_123123123132132132_number@c.us'
     *     },
     *     body: '',
     *     type: 'created_membership_requests',
     *     timestamp: 1694456538,
     *     chatId: 'groupId@g.us',
     *     author: 'number@c.us',
     *     recipientIds: []
     * }
     *
     */
    console.log(notification);
    /** You can approve or reject the newly appeared membership request: */
    await client.approveGroupMembershipRequestss(notification.chatId, notification.author);
    await client.rejectGroupMembershipRequests(notification.chatId, notification.author);
});

client.on('message_reaction', async (reaction) => {
    console.log('REACTION RECEIVED', reaction);
});

client.on('vote_update', (vote) => {
    /** The vote that was affected: */
    console.log(vote);
});
const generateImage = (qrCode) => {
    let qr_svg = qr.image(qrCode, { type: 'svg', margin: 4 });
    qr_svg.pipe(require('fs').createWriteStream('qr-code.svg'));
    console.log(`⚡ Recuerda que el QR se actualiza cada minuto ⚡'`);
    console.log(`⚡ Actualiza F5 el navegador para mantener el mejor QR⚡`);
    console.log('http://localhost:9000/qr');
}

// Ruta para servir el QR
app.get('/qr', (req, res) => {
    const qrPath = path.join(__dirname, 'qr-code.svg');
    if (fs.existsSync(qrPath)) {
        res.sendFile(qrPath);
    } else {
        res.status(404).send(`
            <html>
                <head><title>QR Code</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>QR Code no disponible</h1>
                    <p>El código QR aún no ha sido generado. Espera a que se genere automáticamente.</p>
                    <p>Si ya escaneaste el QR anteriormente, el cliente debería estar conectándose...</p>
                    <a href="/">Volver al inicio</a>
                </body>
            </html>
        `);
    }
});
//test message
app.get('/test-message', async (req, res) => {
    try {
        // Verificar si el cliente está listo
        if (!isClientReady) {
            return res.status(503).send(`
                <html>
                    <head><title>Error</title></head>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>❌ Cliente no está listo</h1>
                        <p>El cliente de WhatsApp aún no está conectado. Por favor espera a que se conecte.</p>
                        <p>Revisa la consola para ver el estado de la conexión.</p>
                        <a href="/">Volver al inicio</a>
                    </body>
                </html>
            `);
        }

        // Obtener el número del query string o usar el por defecto
        const phoneNumber = req.query.number || '51997377840';
        //const phoneNumber='120363401744064249';
        //const phoneNumber = '120363401744064249';
        const message = req.query.message || 'Hello, this is a test message from the server';
        
        // Formatear el número correctamente (debe incluir @c.us)
        const formattedNumber = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
        
        console.log(`📤 Enviando mensaje a ${formattedNumber}...`);
        
        // Enviar el mensaje
        const result = await client.sendMessage(formattedNumber, message, {
            sendSeen: false
        });
        
        console.log(`✅ Mensaje enviado exitosamente. ID: ${result.id._serialized}`);
        
        res.send(`
            <html>
                <head>
                    <title>Mensaje Enviado</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                        .success { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; }
                        a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #25D366; color: white; text-decoration: none; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="success">
                        <h2>✅ Mensaje enviado exitosamente</h2>
                        <p><strong>Para:</strong> ${formattedNumber}</p>
                        <p><strong>Mensaje:</strong> ${message}</p>
                        <p><strong>ID del mensaje:</strong> ${result.id._serialized}</p>
                    </div>
                    <a href="/">Volver al inicio</a>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error);
        res.status(500).send(`
            <html>
                <head><title>Error</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>❌ Error al enviar mensaje</h1>
                    <p>${error.message}</p>
                    <p><small>Revisa la consola para más detalles.</small></p>
                    <a href="/">Volver al inicio</a>
                </body>
            </html>
        `);
    }
});
//test group - Enviar mensaje a grupo
app.get('/test-group', async (req, res) => {
    try {
        // Verificar si el cliente está listo
        if (!isClientReady) {
            return res.status(503).send(`
                <html>
                    <head><title>Error</title></head>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>❌ Cliente no está listo</h1>
                        <p>El cliente de WhatsApp aún no está conectado. Por favor espera a que se conecte.</p>
                        <p>Revisa la consola para ver el estado de la conexión.</p>
                        <a href="/">Volver al inicio</a>
                    </body>
                </html>
            `);
        }

        // Obtener el grupo ID del query string o usar el por defecto
        const groupId = req.query.group || '120363401744064249@g.us';
        const message = req.query.message || 'Hello, this is a test message to the group from the server';
        
        // Formatear el grupo ID correctamente (debe incluir @g.us)
        const formattedGroupId = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
        
        console.log(`📤 Enviando mensaje al grupo ${formattedGroupId}...`);
        
        // Enviar el mensaje al grupo
        const result = await client.sendMessage(formattedGroupId, message, {
            sendSeen: false
        });
        
        console.log(`✅ Mensaje enviado exitosamente al grupo. ID: ${result.id._serialized}`);
        
        res.send(`
            <html>
                <head>
                    <title>Mensaje Enviado al Grupo</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                        .success { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; }
                        .info { background-color: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 10px; border-radius: 5px; margin-top: 10px; }
                        a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #25D366; color: white; text-decoration: none; border-radius: 5px; }
                        a:hover { background-color: #128C7E; }
                    </style>
                </head>
                <body>
                    <div class="success">
                        <h2>✅ Mensaje enviado exitosamente al grupo</h2>
                        <p><strong>Grupo:</strong> ${formattedGroupId}</p>
                        <p><strong>Mensaje:</strong> ${message}</p>
                        <p><strong>ID del mensaje:</strong> ${result.id._serialized}</p>
                    </div>
                    <div class="info">
                        <p><small>💡 Puedes personalizar el mensaje agregando <code>?message=Tu mensaje</code> a la URL</small></p>
                        <p><small>💡 Puedes cambiar el grupo agregando <code>?group=ID_DEL_GRUPO</code> a la URL</small></p>
                    </div>
                    <a href="/">Volver al inicio</a>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('❌ Error al enviar mensaje al grupo:', error);
        res.status(500).send(`
            <html>
                <head>
                    <title>Error</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 50px; }
                        .error { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; }
                        a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #25D366; color: white; text-decoration: none; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="error">
                        <h1>❌ Error al enviar mensaje al grupo</h1>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p><small>Revisa la consola para más detalles.</small></p>
                    </div>
                    <a href="/">Volver al inicio</a>
                </body>
            </html>
        `);
    }
});
//test file - Enviar PDF
app.get('/test-file', async (req, res) => {
    try {
        // Verificar si el cliente está listo
        if (!isClientReady) {
            return res.status(503).send(`
                <html>
                    <head><title>Error</title></head>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>❌ Cliente no está listo</h1>
                        <p>El cliente de WhatsApp aún no está conectado. Por favor espera a que se conecte.</p>
                        <p>Revisa la consola para ver el estado de la conexión.</p>
                        <a href="/">Volver al inicio</a>
                    </body>
                </html>
            `);
        }

        // Obtener parámetros del query string
        const phoneNumber = req.query.number || '51997377840';
        const fileName = req.query.file || 'alert_17.pdf';
        const caption = req.query.caption || 'Envío de archivo PDF de prueba';
        
        // Formatear el número correctamente (debe incluir @c.us)
        const formattedNumber = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
        
        // Construir la ruta completa del archivo
        const filePath = path.join(__dirname, fileName);
        
        // Verificar que el archivo existe
        if (!fs.existsSync(filePath)) {
            return res.status(404).send(`
                <html>
                    <head><title>Error</title></head>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>❌ Archivo no encontrado</h1>
                        <p>El archivo <strong>${fileName}</strong> no existe en la ruta:</p>
                        <p><code>${filePath}</code></p>
                        <p>Verifica que el archivo esté en el directorio del proyecto.</p>
                        <a href="/">Volver al inicio</a>
                    </body>
                </html>
            `);
        }
        
        console.log(`📤 Preparando envío de archivo: ${fileName} a ${formattedNumber}...`);
        
        // Crear MessageMedia desde el archivo
        const media = MessageMedia.fromFilePath(filePath);
        
        console.log(`📄 Archivo cargado: ${fileName} (${media.mimetype})`);
        
        // Enviar el mensaje con el archivo como documento
        const result = await client.sendMessage(formattedNumber, media, {
            sendMediaAsDocument: true,
            caption: caption,
            sendSeen: false
        });
        
        console.log(`✅ Archivo enviado exitosamente. ID: ${result.id._serialized}`);
        
        res.send(`
            <html>
                <head>
                    <title>Archivo Enviado</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
                        .success { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; }
                        .info { background-color: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 10px; border-radius: 5px; margin-top: 10px; }
                        a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #25D366; color: white; text-decoration: none; border-radius: 5px; }
                        a:hover { background-color: #128C7E; }
                    </style>
                </head>
                <body>
                    <div class="success">
                        <h2>✅ Archivo enviado exitosamente</h2>
                        <p><strong>Para:</strong> ${formattedNumber}</p>
                        <p><strong>Archivo:</strong> ${fileName}</p>
                        <p><strong>Tipo:</strong> ${media.mimetype}</p>
                        <p><strong>Descripción:</strong> ${caption}</p>
                        <p><strong>ID del mensaje:</strong> ${result.id._serialized}</p>
                    </div>
                    <div class="info">
                        <p><small>El archivo se envió como documento. El destinatario podrá descargarlo desde WhatsApp.</small></p>
                    </div>
                    <a href="/">Volver al inicio</a>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('❌ Error al enviar archivo:', error);
        res.status(500).send(`
            <html>
                <head>
                    <title>Error</title>
                    <style>
                        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 50px; }
                        .error { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; }
                        a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #25D366; color: white; text-decoration: none; border-radius: 5px; }
                    </style>
                </head>
                <body>
                    <div class="error">
                        <h1>❌ Error al enviar archivo</h1>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p><small>Revisa la consola para más detalles.</small></p>
                    </div>
                    <a href="/">Volver al inicio</a>
                </body>
            </html>
        `);
    }
});

// Ruta GET para documentación de la API
app.get('/test-file-postman', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>API - Enviar Archivo por WhatsApp</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                    h1 { color: #25D366; }
                    .endpoint { background-color: #f8f9fa; border-left: 4px solid #25D366; padding: 15px; margin: 20px 0; }
                    .method { display: inline-block; background-color: #25D366; color: white; padding: 5px 10px; border-radius: 3px; font-weight: bold; }
                    .method.post { background-color: #49a049; }
                    code { background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
                    .param { margin: 10px 0; padding: 10px; background-color: #e9ecef; border-radius: 5px; }
                    .param strong { color: #25D366; }
                    .example { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    a { display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #25D366; color: white; text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>📡 API - Enviar Archivo por WhatsApp</h1>
                
                <div class="endpoint">
                    <span class="method post">POST</span> <code>/test-file-postman</code>
                </div>
                
                <h2>Descripción</h2>
                <p>Endpoint para enviar archivos (PDF, imágenes, documentos, etc.) por WhatsApp usando form-data.</p>
                
                <h2>Parámetros (form-data)</h2>
                <div class="param">
                    <strong>file</strong> (requerido)<br>
                    <small>Archivo a enviar. Puede ser PDF, imagen, documento, etc. Límite: 100MB</small>
                </div>
                <div class="param">
                    <strong>number</strong> (opcional)<br>
                    <small>Número de teléfono del destinatario (sin @c.us). Por defecto: 51997377840</small>
                </div>
                <div class="param">
                    <strong>caption</strong> (opcional)<br>
                    <small>Descripción o mensaje que acompaña al archivo. Por defecto: "Archivo enviado desde API"</small>
                </div>
                
                <h2>Ejemplo de uso en Postman</h2>
                <div class="example">
                    <ol>
                        <li>Método: <strong>POST</strong></li>
                        <li>URL: <code>http://localhost:9000/test-file-postman</code></li>
                        <li>Body → form-data</li>
                        <li>Agregar campos:
                            <ul>
                                <li><code>file</code> (tipo: File) - Selecciona tu archivo PDF</li>
                                <li><code>number</code> (tipo: Text) - Ejemplo: 51997377840</li>
                                <li><code>caption</code> (tipo: Text) - Ejemplo: "Documento importante"</li>
                            </ul>
                        </li>
                    </ol>
                </div>
                
                <h2>Respuesta exitosa (JSON)</h2>
                <pre style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto;">
{
  "success": true,
  "message": "Archivo enviado exitosamente",
  "data": {
    "messageId": "false_51997377840@c.us_ABC123",
    "to": "51997377840@c.us",
    "fileName": "alert_17.pdf",
    "mimetype": "application/pdf",
    "fileSize": 123456,
    "caption": "Documento importante"
  }
}
                </pre>
                
                <h2>Respuesta de error (JSON)</h2>
                <pre style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto;">
{
  "success": false,
  "error": "Error al enviar archivo",
  "message": "Descripción del error"
}
                </pre>
                
                <h2>Estado del cliente</h2>
                <p><strong>Cliente WhatsApp:</strong> ${isClientReady ? '✅ Conectado' : '⏳ Conectando...'}</p>
                ${!isClientReady ? '<p style="color: #856404;">⚠️ El cliente debe estar conectado antes de enviar archivos.</p>' : ''}
                
                <a href="/">Volver al inicio</a>
            </body>
        </html>
    `);
});

// Ruta POST para recibir archivo desde Postman (form-data)
app.post('/test-file-postman', upload.single('file'), async (req, res) => {
    try {
        // Verificar si el cliente está listo
        if (!isClientReady) {
            return res.status(503).json({
                success: false,
                error: 'Cliente no está listo',
                message: 'El cliente de WhatsApp aún no está conectado. Por favor espera a que se conecte.'
            });
        }

        // Verificar que se haya enviado un archivo
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Archivo no proporcionado',
                message: 'Debes enviar un archivo en el campo "file" usando form-data.'
            });
        }

        // Obtener parámetros del body
        const phoneNumber = req.body.number || '51997377840';

        const caption = req.body.caption || 'Archivo enviado desde API';

        if(phoneNumber.includes('@g.us')){
            formattedNumber = phoneNumber.includes('@g.us') ? phoneNumber : `${phoneNumber}@g.us`;
        }else{
            formattedNumber = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
        }
        
        // Formatear el número correctamente (debe incluir @c.us)
       

        // Formatear el grupo ID correctamente (debe incluir @g.us)
    
        
        // Obtener información del archivo
        const fileBuffer = req.file.buffer;
        const originalName = req.file.originalname || 'archivo.pdf';
        const mimetype = req.file.mimetype || mime.getType(originalName) || 'application/pdf';
        
        console.log(`📤 Recibido archivo desde API: ${originalName} (${mimetype}, ${fileBuffer.length} bytes)`);
        console.log(`📤 Enviando a: ${formattedNumber}`);
        
        // Convertir el buffer a base64
        const base64Data = fileBuffer.toString('base64');
        
        // Crear MessageMedia desde el buffer
        const media = new MessageMedia(mimetype, base64Data, originalName);
        
        // Enviar el mensaje con el archivo como documento
        const result = await client.sendMessage(formattedNumber, media, {
            sendMediaAsDocument: true,
            caption: caption,
            sendSeen: false
        });
        
        console.log(`✅ Archivo enviado exitosamente. ID: ${result.id._serialized}`);
        
        // Responder con JSON para API
        res.json({
            success: true,
            message: 'Archivo enviado exitosamente',
            data: {
                messageId: result.id._serialized,
                to: formattedNumber,
                fileName: originalName,
                mimetype: mimetype,
                fileSize: fileBuffer.length,
                caption: caption
            }
        });
    } catch (error) {
        console.error('❌ Error al enviar archivo:', error);
        res.status(500).json({
            success: false,
            error: 'Error al enviar archivo',
            message: error.message,
            details: error.stack
        });
    }
});
// test message -post man number and message
app.post('/test-sismo-realtime', async (req, res) => {
    try {
        // Verificar si el cliente está listo
        if (!isClientReady) {
            return res.status(503).json({
                success: false,
                error: 'Cliente no está listo',
                message: 'El cliente de WhatsApp aún no está conectado. Por favor espera a que se conecte.'
            });
        }

        // Obtener parámetros del body
        const phoneNumber = req.body.number || '51997377840';
        const message = req.body.message || 'Sismo detectado en tiempo real';
          
        if(phoneNumber.includes('@g.us')){
            formattedNumber = phoneNumber.includes('@g.us') ? phoneNumber : `${phoneNumber}@g.us`;
        }else{
            formattedNumber = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
        }
        



        
        // Formatear el número correctamente (debe incluir @c.us)
        //const formattedNumber = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
        
        console.log(`📤 Enviando mensaje a ${formattedNumber}...`);
        
        // Enviar el mensaje
        const result = await client.sendMessage(formattedNumber, message, {
            sendSeen: false
        });
        
        console.log(`✅ Mensaje enviado exitosamente. ID: ${result.id._serialized}`);

        // Responder con JSON para API
        res.json({
            success: true,
            message: 'Mensaje enviado exitosamente',
            data: {
                messageId: result.id._serialized,
                to: formattedNumber,
                message: message
            }
        });
    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error);
        res.status(500).json({
            success: false,
            error: 'Error al enviar mensaje',
            message: error.message,
            details: error.stack
        });
    }
});
// Ruta raíz
app.get('/', (req, res) => {
    const qrExists = fs.existsSync(path.join(__dirname, 'qr-code.svg'));
    const clientStatus = isClientReady ? '✅ Conectado' : '⏳ Conectando...';
    const clientStatusClass = isClientReady ? 'success' : 'info';
    res.send(`
        <html>
            <head>
                <title>WhatsApp Web.js Server</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                    h1 { color: #25D366; }
                    .status { padding: 15px; margin: 20px 0; border-radius: 5px; }
                    .success { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
                    .info { background-color: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
                    .warning { background-color: #fff3cd; border: 1px solid #ffeeba; color: #856404; }
                    a { display: inline-block; margin: 10px 10px 0 0; padding: 10px 20px; background-color: #25D366; color: white; text-decoration: none; border-radius: 5px; }
                    a:hover { background-color: #128C7E; }
                    a.secondary { background-color: #6c757d; }
                    a.secondary:hover { background-color: #5a6268; }
                </style>
            </head>
            <body>
                <h1>🚀 WhatsApp Web.js Server</h1>
                <div class="status ${clientStatusClass}">
                    <strong>Estado del servidor:</strong> ✅ Activo<br>
                    <strong>Puerto:</strong> 9000<br>
                    <strong>Cliente WhatsApp:</strong> ${clientStatus}<br>
                    <strong>QR Code:</strong> ${qrExists ? '✅ Disponible' : '⏳ Generándose...'}
                </div>
                ${qrExists ? '<a href="/qr">Ver Código QR</a>' : ''}
                ${isClientReady ? '<a href="/test-message" class="secondary">Enviar Mensaje de Prueba</a>' : ''}
                ${isClientReady ? '<a href="/test-group" class="secondary">Enviar Mensaje a Grupo</a>' : ''}
                ${isClientReady ? '<a href="/test-file" class="secondary">Enviar PDF de Prueba</a>' : ''}
                ${!isClientReady ? '<div class="status warning"><p>⚠️ El cliente aún no está listo. Espera a ver "✅ READY" en la consola antes de enviar mensajes.</p></div>' : ''}
                <p><small>Si ya escaneaste el QR, el cliente debería estar conectándose. Revisa la consola para ver el estado.</small></p>
            </body>
        </html>
    `);
});

// Función para cerrar correctamente el cliente y el servidor
async function gracefulShutdown(signal) {
    console.log(`\n🛑 Señal ${signal} recibida. Cerrando aplicación correctamente...`);
    
    try {
        // Cerrar el cliente de WhatsApp si está inicializado
        if (client && client.pupPage) {
            console.log('🔌 Cerrando cliente de WhatsApp...');
            await client.destroy();
            console.log('✅ Cliente de WhatsApp cerrado correctamente');
        }
        
        // Cerrar el servidor Express
        if (server) {
            server.close(() => {
                console.log('✅ Servidor Express cerrado correctamente');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    } catch (error) {
        console.error('❌ Error durante el cierre:', error);
        process.exit(1);
    }
}

// Manejar señales de terminación (Ctrl+C, kill, etc.)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    // Errores transitorios comunes durante la inicialización que no deberían cerrar la app
    const isTransientError = reason && (
        reason.message && (
            reason.message.includes('Execution context was destroyed') ||
            reason.message.includes('Target closed') ||
            reason.message.includes('Session closed') ||
            reason.message.includes('Navigation timeout')
        )
    );
    
    if (isTransientError) {
        // Solo registrar el error pero no cerrar la aplicación
        console.warn('⚠️ Error transitorio durante la inicialización (ignorado):', reason.message);
        console.log('💡 El cliente continuará intentando conectarse...');
    } else {
        // Para otros errores, registrar y cerrar
        console.error('❌ Promesa rechazada no manejada:', reason);
        // No cerrar inmediatamente, solo registrar para debugging
        // gracefulShutdown('unhandledRejection');
    }
});

// Manejo de errores del servidor
const PORT = 9090;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🌐 Server Express listo en puerto ' + PORT + '!');
    console.log('📡 Esperando conexión de WhatsApp...');
    console.log('💻 Aplicación de NodeJS (PID: ' + process.pid + ') iniciada');
    console.log('⏳ El cliente de WhatsApp puede tardar unos segundos en conectarse...');
    console.log('🌍 Accede a: http://localhost:' + PORT);
    console.log('💡 Presiona Ctrl+C para cerrar correctamente la aplicación');
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('❌ Error: El puerto ' + PORT + ' ya está en uso.');
        console.error('💡 Cierra la aplicación que está usando el puerto ' + PORT + ' o cambia el puerto en el código.');
    } else {
        console.error('❌ Error al iniciar el servidor:', err);
    }
    process.exit(1);
});
