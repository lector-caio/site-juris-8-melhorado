/**
 * Formulário "Falar com um especialista" → e-mail para o time comercial da Juris8.
 *
 * Variáveis de ambiente (Vercel → Settings → Environment Variables):
 *   EMAIL_USER  conta que envia (Gmail com senha de app, ou usuário SMTP)
 *   EMAIL_PASS  senha de app / senha SMTP
 *   EMAIL_TO    destinatários, separados por vírgula
 *   SMTP_HOST, SMTP_PORT  opcionais; sem eles o envio usa o Gmail
 */
const nodemailer = require('nodemailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function transport() {
  const { EMAIL_USER, EMAIL_PASS, SMTP_HOST, SMTP_PORT } = process.env;
  const auth = { user: EMAIL_USER, pass: EMAIL_PASS };
  if (SMTP_HOST) {
    const port = Number(SMTP_PORT) || 587;
    return nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth });
  }
  return nodemailer.createTransport({ service: 'gmail', auth });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const body = req.body || {};
  const field = (k) => String(body[k] || '').trim();
  const nome = field('nome');
  const email = field('email');
  const telefone = field('telefone');
  const empresa = field('empresa');
  const interesse = field('interesse');
  const origem = field('origem');
  const mensagem = field('mensagem');

  // Honeypot: bots preenchem o campo oculto; pessoas deixam vazio
  if (field('website')) {
    res.status(200).json({ ok: true });
    return;
  }

  if (!nome || !empresa || !telefone || !EMAIL_RE.test(email)) {
    res.status(400).json({ ok: false, error: 'invalid_fields' });
    return;
  }

  const { EMAIL_USER, EMAIL_PASS, EMAIL_TO } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
    console.error('[contact] variáveis EMAIL_USER, EMAIL_PASS e EMAIL_TO não configuradas');
    res.status(500).json({ ok: false, error: 'server_not_configured' });
    return;
  }

  // Páginas de solução mandam os campos próprios (CNPJs, área, processos...) em `extras`;
  // a home manda só `porte`.
  const extras = Array.isArray(body.extras)
    ? body.extras
        .filter((x) => x && x.label && x.value)
        .slice(0, 12)
        .map((x) => [String(x.label).slice(0, 80), String(x.value).slice(0, 500)])
    : [];
  const rows = [
    ['Nome', nome],
    ['Escritório / empresa', empresa],
    ['E-mail', email],
    ['Telefone / WhatsApp', telefone],
    ...(extras.length ? extras : [['Porte', field('porte') || '—']]),
    ['Interesse', interesse || '—'],
    ['Página', field('page') || '—'],
    ['Origem', origem || '—'],
  ];
  const html =
    '<h2 style="font-family:Arial,sans-serif;color:#2E1463">Novo contato pelo site Juris8</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' +
    rows.map(([k, v]) => `<tr><td style="font-weight:bold;vertical-align:top">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('') +
    '</table>' +
    `<p style="font-family:Arial,sans-serif;font-weight:bold">Detalhes</p><p style="font-family:Arial,sans-serif;font-size:14px">${escapeHtml(mensagem || '—').replace(/\n/g, '<br>')}</p>`;

  try {
    await transport().sendMail({
      from: `"Site Juris8" <${EMAIL_USER}>`,
      to: EMAIL_TO.split(',').map((s) => s.trim()).filter(Boolean),
      replyTo: email,
      subject: `Novo contato Juris8: ${nome} (${empresa})`,
      html,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] falha no envio', err);
    res.status(500).json({ ok: false, error: 'send_failed' });
  }
};
