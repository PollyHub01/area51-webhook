const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fetch = require('node-fetch');
const qrcode = require('qrcode-terminal');

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const GROUP_ID = '[557399279727-1569545528](557399279727-1569545528)@g.us';

const randomDelay = () => new Promise(r => setTimeout(r, Math.floor(Math.random() * 30000) + 15000));

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    browser: ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', 'Chrome', '122.0.0'],
    connectTimeoutMs: 60000,
    retryRequestDelayMs: randomDelay,
    maxRetries: 5,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 ESCANEIE O QR CODE:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('Conexão fechada, código:', code);
      if (code !== DisconnectReason.loggedOut) {
        await randomDelay();
        connectToWhatsApp();
      }
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp conectado!');
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

      await randomDelay();

      try {
        await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        console.log('✅ Enviado pro Make!');
      } catch (err) {
        console.error('Erro:', err.message);
      }
    }
  });
}

connectToWhatsApp();
