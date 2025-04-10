
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password, captchaToken } = req.body;

  if (!username || !password || !captchaToken) {
    return res.status(400).json({ error: 'Missing username, password or CAPTCHA token' });
  }

  try {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const delimiter = `--${boundary}`;
    const closeDelimiter = `--${boundary}--`;

    const body = [
      delimiter,
      'Content-Disposition: form-data; name="username"',
      '',
      username,
      delimiter,
      'Content-Disposition: form-data; name="password"',
      '',
      password,
      delimiter,
      'Content-Disposition: form-data; name="g-recaptcha-response"',
      '',
      captchaToken,
      closeDelimiter,
      ''
    ].join('\r\n');

    const loginRes = await fetch("https://gwss.engie.ro/myservices/v1/login", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Accept": "application/json",
        "Origin": "https://my.engie.ro",
        "Referer": "https://my.engie.ro/",
        "User-Agent": "Mozilla/5.0"
      },
      body,
      redirect: 'manual'
    });

    const cookies = loginRes.headers.raw()['set-cookie'];
    const sessionCookie = cookies?.map(c => c.split(';')[0]).join('; ');

    const text = await loginRes.text();
    let loginData;
    try {
      loginData = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: 'Login failed. Invalid JSON returned from Engie.', raw: text });
    }

    if (!loginRes.ok || loginData?.error) {
      return res.status(401).json({ error: 'Login failed.', details: loginData });
    }

    const contract = loginData.data?.[0];
    const poc = contract?.places_of_consumption?.[0]?.poc_number;
    const pa = contract?.pa;

    if (!poc || !pa) {
      return res.status(400).json({ error: 'Missing POC or PA from login data.' });
    }

    const today = new Date();
    const lastYear = new Date(today);
    lastYear.setFullYear(today.getFullYear() - 1);

    const endDate = today.toISOString().split('T')[0];
    const startDate = lastYear.toISOString().split('T')[0];

    const invoiceRes = await fetch(`https://gwss.engie.ro/myservices/v1/invoices/history-only/${poc}?startDate=${startDate}&endDate=${endDate}&pa=${pa}`, {
      headers: {
        "Accept": "application/json",
        "Cookie": sessionCookie,
        "Origin": "https://my.engie.ro",
        "Referer": "https://my.engie.ro/",
        "User-Agent": "Mozilla/5.0"
      }
    });

    const invoiceData = await invoiceRes.json();
    const invoices = invoiceData?.data?.[0]?.invoices || [];

    return res.status(200).json({
      success: true,
      user: username,
      invoices
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
};
