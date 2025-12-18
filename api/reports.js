export default async function handler(req, res) {
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
  
      const API_URL = "https://www.thereportoftheweekapi.com/api/v1/reports/";
      const r = await fetch(API_URL);
  
      if (!r.ok) {
        res.status(502).json({ error: "Failed to fetch reports from external API" });
        return;
      }
  
      const reports = await r.json();
  
      // Return a consistent object shape
      res.status(200).json({ reports });
    } catch (err) {
      res.status(500).json({ error: err.message || "Server error" });
    }
  }
  