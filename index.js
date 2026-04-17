const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fetch = require('node-fetch');
const qrcode = require('qrcode');
const express = require('express');
const app = express();
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const GROUP_ID = '[557399279727-1569545528](557399279727-1569545528)@g.us';

let currentQR = null;

app.get('/', (req, res) => {
  if (currentQR) {
    res.send(`
      <html>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column">
          <h2>📱 Escaneie com o WhatsApp</h2>
          <img src="${currentQR}" style="width:300px;height:300px"/>
          <p>WhatsApp → Aparelhos conectados → Conectar aparelho</p>
          <p><small>Atualize a página se o QR expirar</small></p>
        </body>
      </html>
    `);
  } else {
    res.send('<h2>✅ WhatsApp já conectado!</h2>');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    browser: ['Chrome', 'Chrome', '122.0.0'],
    connectTimeoutMs: 60000,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQR = await qrcode.toDataURL(qr);
      console.log('📱 QR Code disponível em: [https://area51-webhook-production.up.railway.app](https://area51-webhook-production.up.railway.app)');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(connectToWhatsApp, 5000);
      }
    }

    if (connection === 'open') {
      currentQR = null;
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
