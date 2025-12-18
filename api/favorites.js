import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(200).json({ ok: true });
      return;
    }

    // GET -> load favorites
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("favorites")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(200).json({ favorites: data });
      return;
    }

    // POST -> save favorite
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      if (!body?.title) {
        res.status(400).json({ error: "title is required" });
        return;
      }

      const row = {
        report_id: body.report_id || null,
        title: body.title,
        score: body.score || null,
        url: body.url || null
      };

      const { data, error } = await supabase
        .from("favorites")
        .insert([row])
        .select()
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(201).json({ favorite: data });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
}
