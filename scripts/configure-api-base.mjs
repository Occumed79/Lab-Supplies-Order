import { readFileSync, writeFileSync } from 'node:fs';

const appPath = new URL('../src/App.tsx', import.meta.url);
const defaultApiBaseUrl = 'https://lab-supplies-order-api.onrender.com';
const apiBaseUrl = (process.env.VITE_API_BASE_URL || defaultApiBaseUrl).replace(/\/$/, '');

let source = readFileSync(appPath, 'utf8');
let changed = false;

function block(lines) {
  return lines.join('\n');
}

function replaceOnce(label, from, to) {
  if (!source.includes(from)) {
    console.log(`${label}: no replacement needed.`);
    return;
  }

  source = source.replace(from, to);
  changed = true;
  console.log(`${label}: patched.`);
}

replaceOnce(
  'Production API base URL',
  "const BASE_URL = import.meta.env.DEV ? '/api' : 'https://alex6oks0k.lastapp.dev';",
  `const BASE_URL = import.meta.env.DEV ? '/api' : '${apiBaseUrl}';`
);

replaceOnce(
  'Login role handling',
  block([
    '      // Determine role based on toggle (in a real app, this would be securely checked)',
    "      const role = isClinic ? 'clinic' : 'admin';",
    '      const userWithRole = { ...userData, role };',
    '      setUser(userWithRole);',
    "      localStorage.setItem('user_data', JSON.stringify(userWithRole));",
    '',
    '      if (isClinic) {'
  ]),
  block([
    "      const userWithRole = { ...userData, role: userData.role || 'clinic' };",
    "      const expectedRole = isClinic ? 'clinic' : 'admin';",
    '',
    '      if (userWithRole.role !== expectedRole) {',
    "        throw new Error(`This account is registered as ${userWithRole.role}. Please use the ${userWithRole.role === 'admin' ? 'Admin' : 'Clinic'} login tab.`);",
    '      }',
    '',
    '      setUser(userWithRole);',
    "      localStorage.setItem('user_data', JSON.stringify(userWithRole));",
    '',
    "      if (userWithRole.role === 'clinic') {"
  ])
);

replaceOnce(
  'Invitation status alert',
  block([
    '      await fetch(`${BASE_URL}/data`, {',
    "        method: 'POST',",
    "        headers: { 'Content-Type': 'application/json' },",
    '        body: JSON.stringify({',
    '          app_id: APP_ID,',
    "          table_name: 'invitations',",
    '          data: {',
    '            admin_user_id: user?.id,',
    '            clinic_email: formData.email,',
    '            clinic_name: formData.name,',
    "            invitation_message: formData.message || 'You are invited to join the OCCU MED Lab Supply Portal!',",
    "            invitation_status: 'Sent',",
    '            sent_at: new Date().toISOString()',
    '          }',
    '        })',
    '      });',
    "      alert('Invitation sent successfully!');",
    '      onClose();'
  ]),
  block([
    '      const res = await fetch(`${BASE_URL}/data`, {',
    "        method: 'POST',",
    "        headers: { 'Content-Type': 'application/json' },",
    '        body: JSON.stringify({',
    '          app_id: APP_ID,',
    "          table_name: 'invitations',",
    '          data: {',
    '            admin_user_id: user?.id,',
    '            clinic_email: formData.email,',
    '            clinic_name: formData.name,',
    "            invitation_message: formData.message || 'You are invited to join the OCCU MED Lab Supply Portal!',",
    "            invitation_status: 'Sent',",
    '            sent_at: new Date().toISOString()',
    '          }',
    '        })',
    '      });',
    '',
    "      if (!res.ok) throw new Error('Failed to create invitation');",
    '      const result = await res.json();',
    '',
    "      if (result.email_status === 'sent') {",
    "        alert('Invitation email sent successfully!');",
    "      } else if (result.email_status === 'failed') {",
    "        alert('Invitation was created, but the email failed to send. Please check Resend settings.');",
    '      } else {',
    "        alert('Invitation was created. Email sending is not configured yet.');",
    '      }',
    '',
    '      onClose();'
  ])
);

if (changed) {
  writeFileSync(appPath, source);
}

console.log(`Configured production API base URL: ${apiBaseUrl}`);
