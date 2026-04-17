const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fetch = require('node-fetch');
const qrcode = require('qrcode-terminal');

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const GROUP_ID = '[557399279727-1569545528](557399279727-1569545528)@g.us';

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  
  const sock = makeWASocket({ 
    auth: state,
    browser: ['Area51 Bot', 'Chrome', '1.0.0'],
    connectTimeoutMs: 60000,
    retryRequestDelayMs: 2000,
    maxRetries: 3
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 ESCANEIE O QR CODE ABAIXO:\n');
      qrcode.generate(qr, { small: true });
      console.log('\nAbra o WhatsApp → Aparelhos conectados → Conectar aparelho\n');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('Conexão fechada, código:', code);
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(connectToWhatsApp, 5000);
      }
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp conectado com sucesso!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.remoteJid !== GROUP_ID) continue;
      if (msg.key.fromMe) continue;

      const payload = {
        event: 'message',
        group: 'Compromissos Área51',
        group_id: GROUP_ID,
        from: msg.key.participant || '',
        message: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
        has_image: !!msg.message?.imageMessage,
        message_id: msg.key.id || '',
        timestamp: new Date().toISOString()
      };

      console.log('Nova mensagem detectada:', payload.message);

      try {
        await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        console.log('✅ Enviado pro Make!');
      } catch (err) {
        console.error('Erro ao enviar pro Make:', err.message);
      }
    }
  });
}

connectToWhatsApp();
