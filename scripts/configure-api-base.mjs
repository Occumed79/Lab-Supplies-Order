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
  'Login state for password reset',
  block([
    '  const [loading, setLoading] = useState(false);',
    "  const [error, setError] = useState('');",
    '  const { setUser, setClinic } = useAppContext();',
    '  const navigate = useNavigate();'
  ]),
  block([
    '  const [loading, setLoading] = useState(false);',
    '  const [forgotLoading, setForgotLoading] = useState(false);',
    "  const [error, setError] = useState('');",
    '  const { setUser, setClinic } = useAppContext();',
    '  const navigate = useNavigate();'
  ])
);

replaceOnce(
  'Login response handling',
  block([
    "      if (!res.ok) throw new Error('Invalid credentials');",
    '      const userData = await res.json();'
  ]),
  block([
    '      const userData = await res.json().catch(() => ({}));',
    "      if (!res.ok) throw new Error(userData.error || 'Invalid credentials');"
  ])
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
    "      const normalizedRole = userData.role === 'clinic_user' ? 'clinic' : userData.role;",
    "      const userWithRole = { ...userData, role: normalizedRole || 'clinic' };",
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
  'Friendly login network error',
  block([
    '    } catch (err: any) {',
    "      setError(err.message || 'Login failed');",
    '    } finally {',
    '      setLoading(false);',
    '    }',
    '  };',
    '',
    '  return ('
  ]),
  block([
    '    } catch (err: any) {',
    "      const message = err?.message === 'Load failed' || err?.message === 'Failed to fetch'",
    "        ? 'The login service could not be reached. Please try again in a moment.'",
    "        : (err?.message || 'Login failed');",
    '      setError(message);',
    '    } finally {',
    '      setLoading(false);',
    '    }',
    '  };',
    '',
    '  const handleForgotPassword = async () => {',
    "    const resetEmail = email.trim() || window.prompt('Enter the email address for the account:')?.trim();",
    '    if (!resetEmail) return;',
    '',
    '    setForgotLoading(true);',
    "    setError('');",
    '    try {',
    '      const res = await fetch(`${BASE_URL}/auth/forgot-password`, {',
    "        method: 'POST',",
    "        headers: { 'Content-Type': 'application/json' },",
    '        body: JSON.stringify({ email: resetEmail })',
    '      });',
    '      const payload = await res.json().catch(() => ({}));',
    "      if (!res.ok) throw new Error(payload.error || 'Could not start the password reset.');",
    "      window.alert(payload.message || 'If that account exists, a password-reset link has been sent.');",
    '    } catch (err: any) {',
    "      const message = err?.message === 'Load failed' || err?.message === 'Failed to fetch'",
    "        ? 'The password-reset service could not be reached. Please try again in a moment.'",
    "        : (err?.message || 'Could not start the password reset.');",
    '      setError(message);',
    '    } finally {',
    '      setForgotLoading(false);',
    '    }',
    '  };',
    '',
    '  return ('
  ])
);

replaceOnce(
  'Forgot password button',
  '<button type="button" className="text-xs text-primary hover:underline">Forgot?</button>',
  '<button type="button" onClick={handleForgotPassword} disabled={forgotLoading} className="text-xs text-primary hover:underline disabled:opacity-50">{forgotLoading ? "Sending..." : "Forgot?"}</button>'
);

replaceOnce(
  'Reset password screen',
  '// 3. Clinic Registration Screen',
  block([
    '// Password Reset Screen',
    'const ResetPasswordScreen: React.FC = () => {',
    "  const token = new URLSearchParams(window.location.search).get('token') || '';",
    "  const [password, setPassword] = useState('');",
    "  const [confirmPassword, setConfirmPassword] = useState('');",
    '  const [loading, setLoading] = useState(false);',
    "  const [error, setError] = useState('');",
    "  const [success, setSuccess] = useState('');",
    '  const navigate = useNavigate();',
    '',
    '  const handleSubmit = async (e: React.FormEvent) => {',
    '    e.preventDefault();',
    "    setError('');",
    "    setSuccess('');",
    '',
    '    if (!token) {',
    "      setError('This password-reset link is missing its token. Please request a new link.');",
    '      return;',
    '    }',
    '    if (password !== confirmPassword) {',
    "      setError('Passwords do not match.');",
    '      return;',
    '    }',
    '',
    '    setLoading(true);',
    '    try {',
    '      const res = await fetch(`${BASE_URL}/auth/reset-password`, {',
    "        method: 'POST',",
    "        headers: { 'Content-Type': 'application/json' },",
    '        body: JSON.stringify({ token, password })',
    '      });',
    '      const payload = await res.json().catch(() => ({}));',
    "      if (!res.ok) throw new Error(payload.error || 'Could not reset the password.');",
    "      setSuccess(payload.message || 'Password updated successfully.');",
    "      setTimeout(() => navigate('/login'), 1200);",
    '    } catch (err: any) {',
    "      const message = err?.message === 'Load failed' || err?.message === 'Failed to fetch'",
    "        ? 'The password-reset service could not be reached. Please try again in a moment.'",
    "        : (err?.message || 'Could not reset the password.');",
    '      setError(message);',
    '    } finally {',
    '      setLoading(false);',
    '    }',
    '  };',
    '',
    '  return (',
    '    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero bg-background dark:bg-background">',
    '      <GlassCard className="w-full max-w-md relative overflow-hidden">',
    '        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-primary"></div>',
    '        <div className="text-center mb-8 mt-4">',
    '          <div className="w-16 h-16 mx-auto rounded-2xl glass-panel flex items-center justify-center mb-4 shadow-luminous">',
    '            <i className="fa fa-key text-2xl text-primary"></i>',
    '          </div>',
    '          <h2 className="text-2xl font-bold text-foreground">Set a New Password</h2>',
    '          <p className="text-muted-foreground text-sm mt-2">Create a new password for your portal account.</p>',
    '        </div>',
    '',
    '        {error && <div className="mb-4 p-3 bg-error/10 border border-error/20 text-error rounded-lg text-sm text-center">{error}</div>}',
    '        {success && <div className="mb-4 p-3 bg-success/10 border border-success/20 text-success rounded-lg text-sm text-center">{success}</div>}',
    '',
    '        <form onSubmit={handleSubmit} className="space-y-5">',
    '          <div>',
    '            <label className="block text-sm font-medium text-foreground mb-1 ml-1">New Password</label>',
    '            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="glass-input" placeholder="At least 8 characters" />',
    '          </div>',
    '          <div>',
    '            <label className="block text-sm font-medium text-foreground mb-1 ml-1">Confirm New Password</label>',
    '            <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="glass-input" placeholder="Re-enter your new password" />',
    '          </div>',
    '          <button type="submit" disabled={loading || Boolean(success)} className="glass-button-primary w-full">',
    '            {loading ? <i className="fa fa-spinner fa-spin"></i> : "Update Password"}',
    '          </button>',
    '          <button type="button" onClick={() => navigate("/login")} className="glass-button-secondary w-full">Back to Sign In</button>',
    '        </form>',
    '      </GlassCard>',
    '    </div>',
    '  );',
    '};',
    '',
    '// 3. Clinic Registration Screen'
  ])
);

replaceOnce(
  'Reset password route',
  '        <Route path="/login" element={!user ? <AuthScreen /> : <Navigate to={user.role === \'admin\' ? \'/admin/dashboard\' : \'/clinic/dashboard\'} />} />',
  block([
    '        <Route path="/login" element={!user ? <AuthScreen /> : <Navigate to={user.role === \'admin\' ? \'/admin/dashboard\' : \'/clinic/dashboard\'} />} />',
    '        <Route path="/reset-password" element={<ResetPasswordScreen />} />'
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
    "        alert('Invitation was created, but the email failed to send. Please check SMTP settings.');",
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
