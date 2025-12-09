export default async function handler(req, res) {
    // Enable CORS so your frontend can call this
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    const API_KEY = process.env.LASTFM_API_KEY;
    
    if (!API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    const { method, user, from, to } = req.query;
    
    try {
      const url = `https://ws.audioscrobbler.com/2.0/?method=${method}&user=${user}&api_key=${API_KEY}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}&format=json`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch from Last.fm' });
    }
  }