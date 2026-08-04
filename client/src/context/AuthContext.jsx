import { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('at_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('at_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .getMe()
      .then((res) => setUser((u) => ({ ...u, ...res.data })))
      .catch(() => {
        localStorage.removeItem('at_token');
        localStorage.removeItem('at_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const doLogin = async (username, password) => {
    const res = await api.login(username, password);
    localStorage.setItem('at_token', res.data.token);
    localStorage.setItem('at_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const doLogout = () => {
    localStorage.removeItem('at_token');
    localStorage.removeItem('at_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login: doLogin, logout: doLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
