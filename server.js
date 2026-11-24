// Sid's Property Care — serves the site and sends quote requests via Resend.
const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Gallery: lists every image dropped into public/gallery
app.get('/api/gallery', (req, res) => {
  const dir = path.join(__dirname, 'public', 'gallery');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f)).sort()
    : [];
  res.json(files.map(f => '/gallery/' + encodeURIComponent(f)));
});

const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

app.post('/api/quote', async (req, res) => {
  const { name, phone, email, suburb, service, message, website } = req.body || {};
  if (website) return res.json({ ok: true }); // honeypot: bots fill this, people don't
  if (!name || (!phone && !email)) {
    return res.status(400).json({ ok: false, error: 'Add your name and a phone number or email so Sid can reply.' });
  }

  const rows = [['Name', name], ['Phone', phone], ['Email', email], ['Suburb', suburb], ['Service', service], ['Details', message]]
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top">${k}</td><td style="padding:6px 0">${esc(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || "Sid's Website <onboarding@resend.dev>",
        to: (process.env.TO_EMAIL || 'sidspropertyco@gmail.com').split(','),
        reply_to: email || undefined,
        subject: `New quote request: ${name}${suburb ? ' (' + suburb + ')' : ''}`,
        html: `<div style="font-family:Arial,sans-serif;font-size:15px"><h2 style="color:#500B81">New quote request from the website</h2><table>${rows}</table></div>`
      })
    });
    if (!r.ok) throw new Error(await r.text());
    res.json({ ok: true });
  } catch (err) {
    console.error('Resend error:', err.message);
    res.status(502).json({ ok: false, error: "That didn't send. Please call or text Sid on 0493 711 699." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Sid's Property Care running on ${port}`));
