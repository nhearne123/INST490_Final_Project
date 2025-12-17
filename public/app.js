const page = document.body.dataset.page;

// Only run on Explore page
if (page === "explore") {
  const loadBtn = document.getElementById("loadBtn");
  const applyBtn = document.getElementById("applyBtn");
  const results = document.getElementById("results");

  const favBtn = document.getElementById("favRefreshBtn");
  const favList = document.getElementById("favList");

  loadBtn.addEventListener("click", loadReviews);
  applyBtn.addEventListener("click", applyFilters);
  favBtn.addEventListener("click", loadFavorites);

  let currentReviews = [];
  let fuse = null;        // Fuse.js instance
  let chart = null;       // Chart.js instance

  function escapeHTML(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Convert "8/10" → 8 (or null if not parseable)
  function scoreToNumber(scoreStr) {
    if (!scoreStr) return null;
    const m = String(scoreStr).match(/(\d+)\s*\/\s*10/);
    return m ? Number(m[1]) : null;
  }

  // -----------------------------
  // FETCH #1: Load reviews (FIXED)
  // -----------------------------
  async function loadReviews() {
    results.innerHTML = `<p>Loading...</p>`;

    // ✅ FIX: endpoint should be /api/reports (not /api/reviews)
    const res = await fetch("/api/reports");
    const data = await res.json();

    if (!res.ok) {
      results.innerHTML = `<p>Failed to load reviews: ${escapeHTML(data.error || res.statusText)}</p>`;
      return;
    }

    // ✅ FIX: response shape is { reports: [...] }
    const list = Array.isArray(data.reports) ? data.reports : [];

    // Normalize items so filters/chart always work
    currentReviews = list.map(r => {
      const scoreNum = scoreToNumber(r.score);
      return { ...r, scoreNum };
    });

    // Init Fuse.js
    fuse = new Fuse(currentReviews, {
      keys: ["title"],
      threshold: 0.4
    });

    renderReviews(currentReviews);
    drawChart(currentReviews);
  }

  // -----------------------------
  // FETCH #2: Filter/search (client-side)
  // -----------------------------
  async function applyFilters() {
    const q = document.getElementById("q").value.trim();
    const minScore = document.getElementById("minScore").value;

    let filtered = currentReviews;

    // Fuse search
    if (q && fuse) {
      filtered = fuse.search(q).map(r => r.item);
    }

    // Min score filter
    if (minScore) {
      filtered = filtered.filter(
        r => r.scoreNum !== null && r.scoreNum >= Number(minScore)
      );
    }

    renderReviews(filtered);
    drawChart(filtered);
  }

  // -----------------------------
  // Render review cards
  // -----------------------------
  function renderReviews(list) {
    if (!Array.isArray(list) || list.length === 0) {
      results.innerHTML = `<p>No results.</p>`;
      return;
    }

    results.innerHTML = list.map(item => {
      const id = String(item.id ?? "");
      const title = escapeHTML(item.title || "Untitled");
      const score = escapeHTML(item.score || "N/A");
      const url = item.url || item.video_url || "#";

      return `
        <div class="card">
          <h3>${title}</h3>
          <p class="small">Score: <b>${score}</b></p>
          <div class="row">
            <a href="${escapeHTML(url)}" target="_blank" rel="noreferrer">Open Video</a>
            <button data-save="${escapeHTML(id)}">⭐ Save</button>
          </div>
        </div>
      `;
    }).join("");

    document.querySelectorAll("button[data-save]").forEach(btn => {
      btn.addEventListener("click", () => saveFavorite(btn.dataset.save));
    });
  }

  // -----------------------------
  // Chart.js
  // -----------------------------
  function drawChart(list) {
    const canvasId = "scoreChart";
    let canvas = document.getElementById(canvasId);

    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = canvasId;
      canvas.style.marginTop = "20px";
      results.parentNode.appendChild(canvas);
    }

    const top10 = list.slice(0, 10);
    const labels = top10.map(r => r.title || "Item");
    const scores = top10.map(r => (typeof r.scoreNum === "number" ? r.scoreNum : 0));

    if (chart) chart.destroy();

    chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Review Scores",
          data: scores
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, suggestedMax: 10 }
        }
      }
    });
  }

  // -----------------------------
  // FETCH #3: Save favorite (Supabase)
  // -----------------------------
  async function saveFavorite(id) {
    const item = currentReviews.find(x => String(x.id) === String(id));
    if (!item) return alert("Item not found");

    const payload = {
      report_id: String(item.id),
      title: item.title || "Untitled",
      score: item.score || null,
      url: item.url || item.video_url || null
    };

    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(`Save failed: ${data.error || res.statusText}`);
      return;
    }

    loadFavorites();
  }

  // -----------------------------
  // FETCH #4: Load favorites (FIXED)
  // -----------------------------
  async function loadFavorites() {
    favList.innerHTML = `<p>Loading favorites...</p>`;
    const res = await fetch("/api/favorites");
    const data = await res.json();

    // ✅ FIX: backend returns { favorites: [...] }
    const favs = Array.isArray(data.favorites) ? data.favorites : [];

    if (!favs.length) {
      favList.innerHTML = `<p>No favorites yet.</p>`;
      return;
    }

    favList.innerHTML = favs.map(f => `
      <div class="card">
        <h3>${escapeHTML(f.title)}</h3>
        <p class="small">Score: <b>${escapeHTML(f.score || "N/A")}</b></p>
        ${f.url ? `<a href="${escapeHTML(f.url)}" target="_blank" rel="noreferrer">Open</a>` : ""}
      </div>
    `).join("");
  }
}
