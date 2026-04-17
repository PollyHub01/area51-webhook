const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fetch = require('node-fetch');

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const GROUP_ID = '[557399279727-1569545528](557399279727-1569545528)@g.us';

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state, printQRInTerminal: true });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
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

      await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  });
}

connectToWhatsApp();
