import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { username, password, captchaToken } = await req.json?.() || req.body;

    if (!username || !password || !captchaToken) {
      return res.status(400).json({ error: 'Missing credentials or CAPTCHA' });
    }

    // Send login request to ENGIE
    const loginResponse = await fetch('https://gwss.engie.ro/myservices/v1/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'source': 'desktop',
        'authorization': `Bearer ${captchaToken}`
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const loginData = await loginResponse.json();

    if (!loginResponse.ok || loginData.error) {
      return res.status(loginResponse.status).json({
        error: true,
        message: loginData.description || 'Login failed',
        data: loginData
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: loginData
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
