import { useEffect, useState } from 'react';
import { KeyRound, User, PlusCircle } from 'lucide-react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';
import * as api from '../api/api';
import { errMsg } from '../api/api';

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [form, setForm] = useState(EMPTY_FORM);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', full_name: '', password: '', isAdmin: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // load users for admin user-management panel (only admins can access)
    if (!isAdmin) return;
    async function load() {
      try {
        const res = await api.listUsers();
        setUsers(res.data.data || []);
      } catch (err) {
        // quietly ignore if not authorized
      }
    }
    load();
  }, [isAdmin]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(form.currentPassword, form.newPassword);
      setSuccess('Password changed successfully.');
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
<Layout title="Settings" subtitle={isAdmin ? "Manage your administrator account" : "Manage your account"}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 h-fit">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
              <User size={18} strokeWidth={1.75} />
            </div>
<div className="min-w-0">
              <div className="font-medium text-neutral-900 truncate">{user?.full_name || user?.username}</div>
              <div className="text-xs text-neutral-500">{isAdmin ? 'Administrator' : 'Viewer'}</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound size={17} strokeWidth={1.75} className="text-neutral-500" />
              <h3 className="font-semibold text-neutral-900">Change Password</h3>
            </div>

            <Alert message={error} onClose={() => setError('')} />
            <Alert type="success" message={success} onClose={() => setSuccess('')} />

            <form onSubmit={submit} className="space-y-4 max-w-sm">
              <div>
                <label className="label">Current Password</label>
                <input
                  type="password"
                  className="input"
                  required
                  autoComplete="current-password"
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                />
              </div>
              <div>
                <label className="label">New Password</label>
                <input
                  type="password"
                  className="input"
                  required
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                />
                <p className="text-xs text-neutral-400 mt-1">Minimum 6 characters.</p>
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input
                  type="password"
                  className="input"
                  required
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                />
              </div>
              <div className="pt-2">
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

{isAdmin && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <PlusCircle size={17} strokeWidth={1.75} className="text-neutral-500" />
              <h3 className="font-semibold text-neutral-900">User Management</h3>
            </div>

            <p className="text-sm text-neutral-600 mb-3">Create additional users and promote to admin as needed.</p>

            <div className="mb-4">
              <label className="label">Username</label>
              <input className="input" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
              <label className="label">Full name</label>
              <input className="input" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} />
              <label className="label">Password</label>
              <input type="password" className="input" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              <label className="label">Is admin</label>
              <div className="flex items-center gap-2 mb-2">
                <input id="isAdmin" type="checkbox" checked={newUser.isAdmin} onChange={(e) => setNewUser({ ...newUser, isAdmin: e.target.checked })} />
                <label htmlFor="isAdmin" className="text-sm text-neutral-600">Grant administrator privileges</label>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn-primary"
                  onClick={async () => {
                    setError('');
                    try {
                      await api.createUser({ username: newUser.username, password: newUser.password, full_name: newUser.full_name, role: newUser.isAdmin ? 'admin' : 'user' });
                      setSuccess('User created.');
                      setNewUser({ username: '', full_name: '', password: '', isAdmin: false });
                      const res = await api.listUsers();
                      setUsers(res.data.data || []);
                    } catch (err) {
                      setError(errMsg(err));
                    }
                  }}
                >Create User</button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Existing Users</h4>
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 border rounded px-3 py-2">
                    <div>
                      <div className="font-medium">{u.username} {u.full_name && <span className="text-neutral-500">— {u.full_name}</span>}</div>
                      <div className="text-xs text-neutral-500">{u.role}{!u.is_active ? ' (disabled)' : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn-secondary text-xs" onClick={async () => {
                        try {
                          await api.updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin', is_active: u.is_active ? 0 : 1 });
                          const res = await api.listUsers();
                          setUsers(res.data.data || []);
                        } catch (err) {
                          setError(errMsg(err));
                        }
                      }}>{u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
