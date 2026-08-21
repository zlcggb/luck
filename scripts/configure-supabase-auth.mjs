const projectRef = process.env.SUPABASE_PROJECT_REF || 'jkxjpopqbkjpevkcncrr';
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  throw new Error('Supabase access token was not found. Please set SUPABASE_ACCESS_TOKEN environment variable.');
}

const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

const readConfig = async () => {
  const response = await fetch(endpoint, { headers });
  if (!response.ok) throw new Error(`Unable to read auth config (${response.status})`);
  return response.json();
};

const before = await readConfig();
if (before.mailer_autoconfirm !== true) {
  const response = await fetch(endpoint, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ mailer_autoconfirm: true }),
  });
  if (!response.ok) throw new Error(`Unable to update auth config (${response.status})`);
}

const after = await readConfig();
if (after.mailer_autoconfirm !== true) {
  throw new Error('Email autoconfirm is still disabled');
}

console.log(JSON.stringify({ mailer_autoconfirm: after.mailer_autoconfirm }));
