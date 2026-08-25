export default async function handler(req, res) {
  const { slug } = req.query;
  const path = Array.isArray(slug) ? slug.join('/') : slug;
  
  try {
    const backendUrl = `http://127.0.0.1:8000/${path}`;
    
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': req.headers.authorization || ''
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(backendUrl, fetchOptions);
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error(`Proxy Error for /api/admin/${path}:`, error);
    return res.status(500).json({ message: 'Internal Server Proxy Error', error: error.message });
  }
}
