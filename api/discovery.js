const { loadLocalEnv } = require('./_load-env');
loadLocalEnv();

const BASE_ID = 'app6LArSCs8OBia9i';

function tableId() {
  return process.env.DISCOVERY_TABLE_ID || '';
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseBody(req) {
  if (!req.body) return {};
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

function trim(v) {
  return typeof v === 'string' ? v.trim() : v;
}

function nowIso() {
  return new Date().toISOString();
}

/** Map wizard payload → Airtable fields (only defined keys). */
function toFields(data, { status, step, submitted } = {}) {
  const fields = {};
  const map = {
    name: 'Name',
    email: 'Email',
    company: 'Company',
    problem: 'Problem',
    painWho: 'Pain Who',
    today: 'Today',
    primaryUser: 'Primary User',
    payer: 'Payer',
    market: 'Market',
    pitch: 'Pitch',
    magicMoment: 'Magic Moment',
    productStage: 'Product Stage',
    launchWindow: 'Launch Window',
    budget: 'Budget',
    platform: 'Platform',
    integrations: 'Integrations',
    links: 'Links',
    compliance: 'Compliance',
    successMetric: 'Success Metric',
    riskiestAssumption: 'Riskiest Assumption',
    briefMarkdown: 'Brief Markdown',
    invite: 'Invite',
  };

  for (const [key, field] of Object.entries(map)) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      fields[field] = trim(data[key]);
    }
  }

  if (data.features !== undefined) {
    fields['Features JSON'] =
      typeof data.features === 'string' ? data.features : JSON.stringify(data.features);
  }

  if (typeof step === 'number') fields.Step = step;
  if (status) fields.Status = status;
  fields['Last Saved At'] = nowIso();
  if (submitted) fields['Submitted At'] = nowIso();

  return fields;
}

async function airtable(pat, method, path, body) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function featLines(features, bucket) {
  let list = features;
  if (typeof features === 'string') {
    try {
      list = JSON.parse(features);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return '';
  return list
    .filter((f) => f && f.bucket === bucket)
    .map((f) => f.name)
    .join(', ');
}

function line(label, value) {
  const v = value == null ? '' : String(value).trim();
  return `*${label}:* ${v}`;
}

/** Match the existing "Website Contact Form" Slack style: simple *Label:* value lines. */
async function notifySlack(data, recordId) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    console.warn('SLACK_WEBHOOK_URL not set — skipping Slack notify');
    return { sent: false, reason: 'missing_webhook' };
  }

  const email = trim(data.email) || '';
  const emailLine = email ? `<mailto:${email}|${email}>` : '';
  const table = tableId();
  const airtableUrl =
    recordId && table
      ? `https://airtable.com/${BASE_ID}/${table}/${recordId}`
      : '';

  // Attachments live on the Airtable record — link there instead of listing files in Slack.
  const text = [
    line('Name', data.name),
    `*Email:* ${emailLine}`,
    line('Company', data.company),
    line('Invite', data.invite),
    line('Pitch', data.pitch),
    line('Problem', data.problem),
    line('Who feels it', data.painWho),
    line('How solved today', data.today),
    line('Primary user', data.primaryUser),
    line('Who pays', data.payer),
    line('Market', data.market),
    line('Magic moment', data.magicMoment),
    line('Stage', data.productStage),
    line('Must-haves', featLines(data.features, 'M')),
    line('Should-haves', featLines(data.features, 'S')),
    line('Could-haves', featLines(data.features, 'C')),
    line("Won't-haves", featLines(data.features, 'W')),
    line('Launch', data.launchWindow),
    line('Budget', data.budget),
    line('Platform', data.platform),
    line('Integrations', data.integrations),
    line('Links', data.links),
    line('Compliance', data.compliance),
    line('Success (3 months)', data.successMetric),
    line('Riskiest assumption', data.riskiestAssumption),
    airtableUrl ? `*Airtable:* <${airtableUrl}|Open record>` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'MVP Discovery Wizard',
        icon_emoji: ':memo:',
        text,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Slack webhook failed:', res.status, errText);
      return { sent: false, reason: 'webhook_error' };
    }
    return { sent: true };
  } catch (err) {
    console.error('Slack notify error:', err);
    return { sent: false, reason: 'exception' };
  }
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const pat = process.env.AIRTABLE_PAT;
  const tid = tableId();

  if (!pat) {
    return res.status(500).json({ error: 'AIRTABLE_PAT not configured' });
  }
  if (!tid) {
    return res.status(500).json({
      error: 'DISCOVERY_TABLE_ID not configured',
      hint: 'Run: AIRTABLE_PAT=… node scripts/setup-discovery-table.js',
    });
  }

  if (req.method === 'GET') {
    const id = (req.query && req.query.id) || '';
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const { ok, json } = await airtable(pat, 'GET', `${tid}/${id}`);
    if (!ok) {
      console.error('Airtable GET error:', json);
      return res.status(500).json({ error: 'Failed to load brief' });
    }
    return res.status(200).json({ recordId: json.id, fields: json.fields || {} });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = parseBody(req);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const action = body.action || 'save';
  const recordId = body.recordId || null;
  const step = typeof body.step === 'number' ? body.step : undefined;

  try {
    if (action === 'create') {
      const { name, email, company } = body;
      if (!trim(name) || !trim(email) || !trim(company)) {
        return res.status(400).json({ error: 'Name, email and company are required' });
      }
      const fields = toFields(body, { status: 'In Progress', step: step ?? 0 });
      const { ok, json } = await airtable(pat, 'POST', tid, { fields, typecast: true });
      if (!ok) {
        console.error('Airtable create error:', json);
        return res.status(500).json({ error: 'Failed to create brief', detail: json });
      }
      return res.status(200).json({ success: true, recordId: json.id });
    }

    if (action === 'save' || action === 'submit') {
      if (!recordId) return res.status(400).json({ error: 'Missing recordId' });
      const submitted = action === 'submit';
      const fields = toFields(body, {
        status: submitted ? 'Submitted' : 'In Progress',
        step,
        submitted,
      });
      const { ok, json } = await airtable(pat, 'PATCH', `${tid}/${recordId}`, {
        fields,
        typecast: true,
      });
      if (!ok) {
        console.error('Airtable update error:', json);
        return res.status(500).json({ error: 'Failed to save brief', detail: json });
      }

      let slack = { sent: false };
      if (submitted) {
        slack = await notifySlack(body, json.id);
      }

      return res.status(200).json({ success: true, recordId: json.id, slack });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
