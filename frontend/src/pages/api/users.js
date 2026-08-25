export default async function handler(req, res) {
  const backendBase = 'http://127.0.0.1:8000';
  const authHeader = req.headers.authorization || '';

  // GET /api/users — list all users from local DB
  if (req.method === 'GET') {
    try {
      const r = await fetch(`${backendBase}/users`, {
        headers: { Authorization: authHeader }
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (e) {
      return res.status(500).json({ message: 'Backend unreachable', error: e.message });
    }
  }

  // POST /api/users — create user in Cognito + DB
  if (req.method === 'POST') {
    try {
      const r = await fetch(`${backendBase}/users`, {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (e) {
      return res.status(500).json({ message: 'Backend unreachable', error: e.message });
    }
  }

  // PUT /api/users — update role or is_active
  if (req.method === 'PUT') {
    try {
      const r = await fetch(`${backendBase}/users`, {
        method: 'PUT',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (e) {
      return res.status(500).json({ message: 'Backend unreachable', error: e.message });
    }
  }

  // DELETE /api/users — delete from Cognito + DB
  if (req.method === 'DELETE') {
    try {
      const r = await fetch(`${backendBase}/users`, {
        method: 'DELETE',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch (e) {
      return res.status(500).json({ message: 'Backend unreachable', error: e.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
