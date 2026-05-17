export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawCookie = req.headers.cookie || '';
  const gauthMatch = rawCookie.match(/gauth=([^;]+)/);

  if (!gauthMatch) {
    return res.status(401).json({ error: 'No autenticado. Inicia sesión con Google.' });
  }

  let tokens;
  try {
    tokens = JSON.parse(Buffer.from(gauthMatch[1], 'base64').toString('utf8'));
  } catch {
    return res.status(401).json({ error: 'Cookie inválida. Vuelve a autenticarte.' });
  }

  if (Date.now() >= tokens.expires_at - 60_000) {
    if (!tokens.refresh_token) {
      return res.status(401).json({ error: 'Sesión expirada. Vuelve a autenticarte.' });
    }

    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const refreshed = await refreshRes.json();

    if (refreshed.error) {
      return res.status(401).json({ error: 'No se pudo refrescar el token. Vuelve a autenticarte.' });
    }

    tokens.access_token = refreshed.access_token;
    tokens.expires_at = Date.now() + (refreshed.expires_in * 1000);

    const encoded = Buffer.from(JSON.stringify(tokens)).toString('base64');
    res.setHeader('Set-Cookie', [
      `gauth=${encoded}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
    ]);
  }

  const { action, payload } = req.body;

  if (!action || !payload) {
    return res.status(400).json({ error: 'Faltan action y payload' });
  }

  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
  const authHeader = { Authorization: `Bearer ${tokens.access_token}` };

  try {
    switch (action) {

      case 'writeCell': {
        const { range, value } = payload;
        const sheetsRes = await fetch(`${BASE}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ range, values: [[value]] }),
        });
        const data = await sheetsRes.json();
        if (data.error) return res.status(400).json({ error: data.error.message });
        return res.json({ ok: true, updated: data.updatedCells });
      }

      case 'writeBatch': {
        const { updates } = payload;
        const sheetsRes = await fetch(`${BASE}/values:batchUpdate`, {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: updates.map(({ range, value }) => ({ range, values: [[value]] })),
          }),
        });
        const data = await sheetsRes.json();
        if (data.error) return res.status(400).json({ error: data.error.message });
        return res.json({ ok: true, totalUpdated: data.totalUpdatedCells });
      }

      default:
        return res.status(400).json({ error: `Acción desconocida: ${action}` });
    }

  } catch (err) {
    console.error('Sheets proxy error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
