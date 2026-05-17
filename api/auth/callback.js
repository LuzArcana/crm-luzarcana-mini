export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) return res.redirect('/?auth_error=' + encodeURIComponent(error));
  if (!code) return res.status(400).json({ error: 'No code received from Google' });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = 'https://crm-luzarcana-mini.vercel.app/api/auth/callback';

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) return res.redirect('/?auth_error=' + encodeURIComponent(tokens.error_description || tokens.error));

    const encoded = Buffer.from(JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000),
    })).toString('base64');

    res.setHeader('Set-Cookie', [`gauth=${encoded}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7*24*60*60}`]);
    res.redirect('/?auth=ok');
  } catch (err) {
    console.error(err);
    res.redirect('/?auth_error=server_error');
  }
}
