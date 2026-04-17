const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fetch = require('node-fetch');
const qrcode = require('qrcode');
const express = require('express');

const app = express();
app.use(express.json()); // Importante para receber dados do Make

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const GROUP_ID = '[557399279727-1569545528](557399279727-1569545528)@g.us';

let sock;
let currentQR = null;

// Endpoint que o Make vai chamar para o bot falar no grupo
app.post('/notify', async (req, res) => {
  const { message } = req.body;
  if (!sock || !message) return res.status(400).send('Bot offline ou sem mensagem');
  
  try {
    await sock.sendMessage(GROUP_ID, { text: message });
    res.send('✅ Mensagem enviada ao grupo');
  } catch (err) {
    res.status(500).send('Erro ao enviar: ' + err.message);
  }
});

app.get('/', (req, res) => {
  if (currentQR) {
    res.send(`
      <html>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:sans-serif">
          <h2>📱 Escaneie com o WhatsApp</h2>
          <img src="${currentQR}" style="width:300px;height:300px;border:10px solid white;box-shadow:0 0 20px rgba(0,0,0,0.1)"/>
          <p>WhatsApp → Aparelhos conectados → Conectar aparelho</p>
          <p><small>Atualize a página se o QR expirar</small></p>
        </body>
      </html>
    `);
  } else {
    res.send('<h2>✅ WhatsApp já conectado e pronto!</h2>');
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
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
        console.error('Erro ao enviar pro Make:', err.message);
      }
    }
  });
}

connectToWhatsApp();
