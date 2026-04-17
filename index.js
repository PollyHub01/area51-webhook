const express = require('express');
const app = express();
app.use(express.json());

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const GROUP_ID = '[557399279727-1569545528](557399279727-1569545528)@g.us';

app.post('/webhook', async (req, res) => {
  try {
    const data = req.body;
    if (!data || data.Jid !== GROUP_ID) return res.sendStatus(200);
    if (data.Info?.IsFromMe) return res.sendStatus(200);

    const payload = {
      event: 'message',
      group: 'Compromissos Área51',
      group_id: data.Jid,
      from: data.Info?.Sender || '',
      message: data.Message?.Conversation || data.Message?.ExtendedTextMessage?.Text || '',
      has_image: !!data.Message?.ImageMessage,
      message_id: data.Info?.ID || '',
      timestamp: new Date().toISOString()
    };

    await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.get('/', (req, res) => res.send('Area51 Webhook rodando!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
