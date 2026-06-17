const BASE_ID = 'app6LArSCs8OBia9i';
const TABLE_ID = 'tblMndLO5QhRSmGm4';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    console.error('AIRTABLE_PAT environment variable not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { name, email, building, stage, need, referral, company, website } = body || {};

  if (!name || !email || !building || !stage || !need) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const fields = {
    'Name': name.trim(),
    'Email': email.trim(),
    'Building': building.trim(),
    'Stage': stage,
    'Need': need,
    'Status': 'New',
  };
  if (referral && referral.trim()) fields['Referral'] = referral.trim();
  if (company && company.trim()) fields['Company'] = company.trim();
  if (website && website.trim()) fields['Website'] = website.trim();

  try {
    const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields, typecast: true }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Airtable error:', err);
      return res.status(500).json({ error: 'Failed to save submission' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
