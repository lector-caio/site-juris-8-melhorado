/**
 * Formulário "Falar com um especialista" → salva lead no Supabase.
 *
 * Variáveis de ambiente obrigatórias (Vercel → Settings → Environment Variables):
 *   SUPABASE_URL              URL do projeto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY chave service_role (bypass RLS)
 *
 * Variáveis opcionais (para envio de e-mail adicional via Gmail/SMTP):
 *   EMAIL_USER  conta que envia
 *   EMAIL_PASS  senha de app
 *   EMAIL_TO    destinatários, separados por vírgula
 *   SMTP_HOST, SMTP_PORT  opcionais; sem eles usa Gmail
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function saveToSupabase(lead) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[contact] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados — lead não salvo no banco.');
    return null;
  }

  // Mapeia para as colunas reais da tabela public.leads
  const row = {
    name:    lead.nome,
    email:   lead.email,
    phone:   lead.telefone,
    office:  lead.empresa,
    cnpjs:   lead.porte   || 'Não informado',
    message: lead.mensagem || lead.interesse || '',
    source:  lead.origem   || lead.page || '',
    consent: true,
    status:  'novo',
    notes:   '',
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error('[contact] Erro ao salvar no Supabase:', err);
    throw new Error('supabase_error');
  }
  return true;
}

async function sendEmail(lead) {
  const { EMAIL_USER, EMAIL_PASS, EMAIL_TO, SMTP_HOST, SMTP_PORT } = process.env;
  if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) return; // e-mail não configurado, ignora silenciosamente

  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch { return; } // sem nodemailer instalado, ignora

  const auth = { user: EMAIL_USER, pass: EMAIL_PASS };
  const transport = SMTP_HOST
    ? nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT) || 587, secure: Number(SMTP_PORT) === 465, auth })
    : nodemailer.createTransport({ service: 'gmail', auth });

  const rows = [
    ['Nome',               lead.nome],
    ['Escritório',         lead.empresa],
    ['E-mail',             lead.email],
    ['Telefone/WhatsApp',  lead.telefone],
    ['Porte',              lead.porte     || '—'],
    ['Interesse',          lead.interesse || '—'],
    ['Página',             lead.page      || '—'],
    ['Origem',             lead.origem    || '—'],
  ];

  const html =
    '<h2 style="font-family:Arial,sans-serif;color:#2E1463">Novo contato pelo site Juris8</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' +
    rows.map(([k, v]) => `<tr><td style="font-weight:bold;vertical-align:top">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('') +
    '</table>' +
    `<p style="font-family:Arial,sans-serif;font-weight:bold">Detalhes</p><p style="font-family:Arial,sans-serif;font-size:14px">${escapeHtml(lead.mensagem || '—').replace(/\n/g, '<br>')}</p>`;

  try {
    await transport.sendMail({
      from: `"Site Juris8" <${EMAIL_USER}>`,
      to: EMAIL_TO.split(',').map((s) => s.trim()).filter(Boolean),
      replyTo: lead.email,
      subject: `Novo contato Juris8: ${lead.nome} (${lead.empresa})`,
      html,
    });
  } catch (err) {
    console.error('[contact] Falha no envio de e-mail (lead já salvo no banco):', err.message);
    // Não propaga — o lead já foi salvo no Supabase, e-mail é secundário
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const body = req.body || {};
  const field = (k) => String(body[k] || '').trim();

  // Honeypot anti-spam
  if (field('website')) {
    res.status(200).json({ ok: true });
    return;
  }

  const lead = {
    nome:      field('nome'),
    email:     field('email').toLowerCase(),
    telefone:  field('telefone'),
    empresa:   field('empresa'),
    porte:     field('porte'),
    interesse: field('interesse'),
    origem:    field('origem'),
    mensagem:  field('mensagem'),
    page:      field('page'),
  };

  if (!lead.nome || !lead.empresa || !lead.telefone || !EMAIL_RE.test(lead.email)) {
    res.status(400).json({ ok: false, error: 'invalid_fields' });
    return;
  }

  try {
    await saveToSupabase(lead);
  } catch (err) {
    console.error('[contact] Falha crítica ao salvar lead:', err);
    res.status(500).json({ ok: false, error: 'save_failed' });
    return;
  }

  // E-mail é disparado em paralelo — não bloqueia a resposta
  sendEmail(lead).catch(() => {});

  res.status(200).json({ ok: true });
};
