const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const login = async (username, password) => {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.message || 'Login failed');
  }

  return await res.json();
};

export const logout = async () => {
  await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include'
  });
};

export const getMe = async () => {
  const res = await fetch(`${API_BASE}/me`, {
    credentials: 'include'
  });

  if (!res.ok) return null;
  return await res.json();
};
