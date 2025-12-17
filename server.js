require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

// External API (Report of the Week)
const REPORT_API = "https://www.thereportoftheweekapi.com/api/v1/reports/";

// Supabase (SERVER ONLY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---------- Helpers ----------
function parseScore(score) {
  if (!score) return null;
  const s = String(score).trim();
  if (s.includes("/")) {
    const left = Number(s.split("/")[0]);
    return Number.isFinite(left) ? left : null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------- API: Reviews (External API) ----------
app.get("/api/reviews", async (req, res) => {
  try {
    const { q, minScore } = req.query;

    const r = await fetch(REPORT_API);
    if (!r.ok) return res.status(502).json({ error: "External API failed" });

    let data = await r.json();

    // normalize score
    data = data.map((item) => ({ ...item, scoreNum: parseScore(item.score) }));

    // optional filters
    if (q) {
      const term = q.toLowerCase();
      data = data.filter((x) =>
        (x.title || "").toLowerCase().includes(term)
      );
    }

    if (minScore) {
      const min = Number(minScore);
      data = data.filter((x) => x.scoreNum !== null && x.scoreNum >= min);
    }

    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error in /api/reviews" });
  }
});

// ---------- API: Favorites (Supabase DB) ----------
app.get("/api/favorites", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("favorites")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error in /api/favorites" });
  }
});

app.post("/api/favorites", async (req, res) => {
  try {
    const { report_id, title, score, url } = req.body;

    if (!report_id || !title) {
      return res.status(400).json({ error: "report_id and title are required" });
    }

    const { data, error } = await supabase
      .from("favorites")
      .insert([{ report_id, title, score, url }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error in POST /api/favorites" });
  }
});

app.delete("/api/favorites/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { error } = await supabase.from("favorites").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error in DELETE /api/favorites/:id" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Running: http://localhost:${PORT}`);
});
