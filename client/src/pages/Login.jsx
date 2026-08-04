import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errMsg } from '../api/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Asset Tracker logo" className="h-16 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-xl font-semibold text-white">LACED Media Production</h1>
          <p className="text-neutral-500 text-sm mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-danger-50 text-danger-700 border border-danger-200 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-xs text-neutral-600 mt-4">
          Default admin credentials: <span className="text-neutral-400">admin / admin123</span> — change this after first login.
        </p>
      </div>
    </div>
  );
}
