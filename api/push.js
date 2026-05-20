// api/push.js — OneSignal proxy para CRM Luz Arcana

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  const APP_ID = process.env.ONESIGNAL_APP_ID;
  const API_KEY = process.env.ONESIGNAL_API_KEY;

  if (!APP_ID || !API_KEY) return res.status(500).json({ error: 'Faltan variables de entorno' });

  // ── Obtener total de suscriptores ──
  if (action === 'stats') {
    try {
      const r = await fetch(`https://api.onesignal.com/apps/${APP_ID}`, {
        headers: { Authorization: `Key ${API_KEY}` }
      });
      const data = await r.json();
      return res.status(200).json({
        total: data.players || 0,
        web: data.web_subscriber_count || 0
      });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── Mandar notificación a todos ──
  if (action === 'send') {
    const { title, message, url } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Faltan título y mensaje' });

    try {
      const body = {
        app_id: APP_ID,
        included_segments: ['Total Subscriptions'],
        headings: { es: title, en: title },
        contents: { es: message, en: message },
        url: url || 'https://academialuzarcana.com',
        chrome_web_icon: 'https://academialuzarcana.com/logo.png'
      };

      const r = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${API_KEY}`
        },
        body: JSON.stringify(body)
      });

      const data = await r.json();
      if (data.errors) return res.status(400).json({ error: JSON.stringify(data.errors) });
      return res.status(200).json({ ok: true, recipients: data.recipients, id: data.id });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Acción no reconocida' });
};
