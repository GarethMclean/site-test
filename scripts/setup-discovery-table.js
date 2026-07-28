/**
 * Creates the "Discovery Briefs" table in the Pilot Projects Airtable base.
 *
 * Usage:
 *   AIRTABLE_PAT=patxxx node scripts/setup-discovery-table.js
 *
 * Then add the printed DISCOVERY_TABLE_ID to .env.local and Vercel env.
 */

const BASE_ID = 'app6LArSCs8OBia9i';

const table = {
  name: 'Discovery Briefs',
  description: 'MVP discovery wizard submissions from pilotprojects.dev/discovery',
  fields: [
    { name: 'Name', type: 'singleLineText' },
    { name: 'Email', type: 'email' },
    { name: 'Company', type: 'singleLineText' },
    {
      name: 'Status',
      type: 'singleSelect',
      options: {
        choices: [
          { name: 'Draft' },
          { name: 'In Progress' },
          { name: 'Submitted' },
          { name: 'Reviewed' },
        ],
      },
    },
    { name: 'Step', type: 'number', options: { precision: 0 } },
    { name: 'Problem', type: 'multilineText' },
    { name: 'Pain Who', type: 'multilineText' },
    { name: 'Today', type: 'multilineText' },
    { name: 'Primary User', type: 'multilineText' },
    { name: 'Payer', type: 'singleLineText' },
    {
      name: 'Market',
      type: 'singleSelect',
      options: {
        choices: [
          { name: 'B2B' },
          { name: 'B2C' },
          { name: 'B2B2C' },
          { name: 'Marketplace' },
        ],
      },
    },
    { name: 'Pitch', type: 'singleLineText' },
    { name: 'Magic Moment', type: 'multilineText' },
    {
      name: 'Product Stage',
      type: 'singleSelect',
      options: {
        choices: [
          { name: 'Just the idea' },
          { name: 'Designs / mockups' },
          { name: 'Prototype' },
          { name: 'Live product' },
        ],
      },
    },
    { name: 'Features JSON', type: 'multilineText' },
    {
      name: 'Launch Window',
      type: 'singleSelect',
      options: {
        choices: [
          { name: '< 6 weeks' },
          { name: '6–12 weeks' },
          { name: '3–6 months' },
          { name: 'Flexible' },
        ],
      },
    },
    {
      name: 'Budget',
      type: 'singleSelect',
      options: {
        choices: [
          { name: '< $10k' },
          { name: '$10k–$25k' },
          { name: '$25k–$75k' },
          { name: '$75k+' },
        ],
      },
    },
    {
      name: 'Platform',
      type: 'singleSelect',
      options: {
        choices: [
          { name: 'Web app' },
          { name: 'Mobile app' },
          { name: 'Web + mobile' },
        ],
      },
    },
    { name: 'Integrations', type: 'multilineText' },
    { name: 'Links', type: 'multilineText' },
    { name: 'Compliance', type: 'multilineText' },
    { name: 'Success Metric', type: 'multilineText' },
    { name: 'Riskiest Assumption', type: 'multilineText' },
    { name: 'Brief Markdown', type: 'multilineText' },
    { name: 'Attachments', type: 'multipleAttachments' },
    { name: 'Invite', type: 'singleLineText' },
    { name: 'Submitted At', type: 'dateTime', options: { dateFormat: { name: 'iso' }, timeFormat: { name: '24hour' }, timeZone: 'utc' } },
    { name: 'Last Saved At', type: 'dateTime', options: { dateFormat: { name: 'iso' }, timeFormat: { name: '24hour' }, timeZone: 'utc' } },
  ],
};

async function main() {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    console.error('Set AIRTABLE_PAT before running this script.');
    process.exit(1);
  }

  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(table),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Failed to create table:', JSON.stringify(body, null, 2));
    console.error('\nIf the table already exists, copy its table ID from Airtable → Help → API docs.');
    console.error('Your PAT also needs the schema.bases:write scope to create tables.');
    process.exit(1);
  }

  console.log('Created table:', body.name);
  console.log('DISCOVERY_TABLE_ID=' + body.id);
  console.log('\nAdd that to .env.local and to Vercel project env vars.');
}

main();
