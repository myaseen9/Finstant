export default async function handler(req, res) {
  const backendBase = 'http://127.0.0.1:8000';
  const authHeader = req.headers.authorization || '';

  if (req.method === 'PUT') {
    try {
      const r = await fetch(`${backendBase}/profile`, {
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

  return res.status(405).json({ message: 'Method not allowed' });
}
