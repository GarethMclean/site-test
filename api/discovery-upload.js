const { loadLocalEnv } = require('./_load-env');
loadLocalEnv();

const BASE_ID = 'app6LArSCs8OBia9i';
const MAX_BYTES = 8 * 1024 * 1024; // 8MB — stay under Airtable content upload limits
const ALLOWED = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.apple.keynote',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/markdown',
]);

function tableId() {
  return process.env.DISCOVERY_TABLE_ID || '';
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Expects JSON: { recordId, filename, contentType, fileBase64 }
 * Uploads into the Attachments field via Airtable content API.
 */
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pat = process.env.AIRTABLE_PAT;
  const tid = tableId();
  if (!pat) return res.status(500).json({ error: 'AIRTABLE_PAT not configured' });
  if (!tid) return res.status(500).json({ error: 'DISCOVERY_TABLE_ID not configured' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { recordId, filename, contentType, fileBase64 } = body;
  if (!recordId || !filename || !fileBase64) {
    return res.status(400).json({ error: 'recordId, filename and fileBase64 are required' });
  }

  const type = contentType || 'application/octet-stream';
  if (!ALLOWED.has(type) && !type.startsWith('image/')) {
    return res.status(400).json({ error: 'File type not allowed' });
  }

  const b64 = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    return res.status(400).json({ error: 'File too large (max 8MB)' });
  }

  try {
    const uploadRes = await fetch(
      `https://content.airtable.com/v0/${BASE_ID}/${recordId}/Attachments/uploadAttachment`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pat}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentType: type,
          filename: String(filename).slice(0, 180),
          file: b64,
        }),
      }
    );

    const json = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok) {
      console.error('Airtable upload error:', json);
      return res.status(500).json({ error: 'Upload failed', detail: json });
    }

    return res.status(200).json({ success: true, fields: json.fields || json });
  } catch (err) {
    console.error('Unexpected upload error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
