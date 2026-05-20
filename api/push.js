const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:ricardo@luzarcana.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, subscription, title, body, url, segments } = req.body;

  // ── Guardar suscripción nueva ──
  if (action === 'subscribe') {
    if (!subscription) return res.status(400).json({ error: 'Falta subscription' });

    // Aquí guardaríamos en Sheets — por ahora devolvemos ok
    // (lo conectamos a Sheets en el siguiente paso)
    console.log('Nueva suscripción:', JSON.stringify(subscription));
    return res.status(200).json({ ok: true, message: 'Suscripción registrada' });
  }

  // ── Mandar notificación ──
  if (action === 'send') {
    if (!subscription || !title) return res.status(400).json({ error: 'Faltan datos' });

    const payload = JSON.stringify({
      title: title || 'Luz Arcana',
      body: body || '',
      url: url || 'https://luzarcana.com',
      icon: 'https://luzarcana.com/logo.png',
      badge: 'https://luzarcana.com/logo.png'
    });

    try {
      await webpush.sendNotification(subscription, payload);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Error push:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Acción no reconocida' });
};
