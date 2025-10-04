// ---------- helpers & storage ----------
const $ = (id) => document.getElementById(id);
const todayStr = () => new Date().toISOString().split("T")[0];

function loadConfig() {
  // Always an object { categories: [...] }
  const raw = localStorage.getItem("config");
  if (!raw) return { categories: ["Work (client)", "Work (personal)", "Exercise", "Reading", "TV"] };
  try {
    const obj = JSON.parse(raw);
    if (obj && Array.isArray(obj.categories)) return obj;
  } catch {}
  return { categories: ["Work (client)", "Work (personal)", "Exercise", "Reading", "TV"] };
}
function saveConfig(c) { localStorage.setItem("config", JSON.stringify(c)); }

function loadLogs() {
  try { return JSON.parse(localStorage.getItem("timeLog") || "[]"); }
  catch { return []; }
}
function saveLogs(l) { localStorage.setItem("timeLog", JSON.stringify(l)); }

// ---------- sync indicator ----------
function setSyncStatus(status) {
  const el = $("syncStatus"); if (!el) return;
  if (status === "synced") { el.textContent = "✓ Synced"; el.className = "syncstatus synced"; }
  else if (status === "offline") { el.textContent = "⚠️ Offline"; el.className = "syncstatus offline"; }
  else { el.textContent = "⏳ Syncing..."; el.className = "syncstatus"; }
}

// ---------- cloud sync: logs ----------
async function pushToCloud(entry) {
  try {
    await fetch("/.netlify/functions/pushEntry", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    setSyncStatus("synced");
  } catch (err) { console.warn("Cloud push failed:", err); setSyncStatus("offline"); }
}

async function fetchFromCloud() {
  try {
    const res = await fetch("/.netlify/functions/fetchLogs");
    const data = await res.json();
    if (Array.isArray(data)) saveLogs(data);
    setSyncStatus("synced");
    return data;
  } catch (err) {
    console.warn("Cloud fetch failed:", err);
    setSyncStatus("offline");
    return loadLogs();
  }
}

// ---------- cloud sync: config ----------
async function fetchCloudConfig() {
  try {
    const res = await fetch("/.netlify/functions/config");
    const data = await res.json();
    if (data && Array.isArray(data.categories)) {
      saveConfig(data);
      setSyncStatus("synced");
      return data;
    }
  } catch (err) {
    console.warn("Cloud config fetch failed:", err);
    setSyncStatus("offline");
  }
  return loadConfig();
}

async function pushCloudConfig(categories) {
  try {
    await fetch("/.netlify/functions/config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories }),
    });
    setSyncStatus("synced");
  } catch (err) { console.warn("Cloud config push failed:", err); setSyncStatus("offline"); }
}

// ---------- app state ----------
let config = loadConfig(); // <- local first (fixes blank tabs)
let chartRef = null;

// ---------- tabs ----------
function switchTab(name) {
  document.querySelectorAll("section.card").forEach(s => s.classList.add("hidden"));
  document.querySelectorAll(".tabbtn").forEach(b => b.classList.remove("active"));
  $(name).classList.remove("hidden");
  document.querySelector(`.tabbtn[data-tab="${name}"]`).classList.add("active");
  if (name === "log") renderLogInputs();
  if (name === "history") renderHistory();
  if (name === "viz") renderChart();
}
function bindTabs() {
  document.querySelectorAll(".tabbtn").forEach(btn =>
    btn.addEventListener("click", () => switchTab(btn.dataset.tab))
  );
}

// ---------- CONFIG UI ----------
function renderConfig() {
  const ul = $("categoryList"); if (!ul) return;
  ul.innerHTML = "";
  config.categories.forEach((cat, i) => {
    const li = document.createElement("li");
    li.draggable = true; li.classList.add("draggable-item");

    const inp = document.createElement("input");
    inp.type = "text"; inp.value = cat;
    inp.oninput = (e) => { config.categories[i] = e.target.value; };

    const del = document.createElement("button");
    del.textContent = "✕"; del.className = "iconbtn";
    del.onclick = () => { config.categories.splice(i,1); renderConfig(); };

    li.appendChild(inp); li.appendChild(del); ul.appendChild(li);

    li.addEventListener("dragstart", () => li.classList.add("dragging"));
    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
      const newOrder = Array.from(ul.querySelectorAll("li input")).map(el => el.value);
      config.categories = newOrder;
      saveConfig(config);
      pushCloudConfig(config.categories);
      if (!$("log").classList.contains("hidden")) renderLogInputs();
    });
  });

  // assign dragover handler (idempotent)
  ul.ondragover = (e) => {
    e.preventDefault();
    const dragging = ul.querySelector(".dragging");
    if (!dragging) return;
    const after = getDragAfterElement(ul, e.clientY);
    if (!after) ul.appendChild(dragging); else ul.insertBefore(dragging, after);
  };
}
function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll(".draggable-item:not(.dragging)")];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  els.forEach(child => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height/2;
    if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
  });
  return closest.element;
}

function bindConfigButtons() {
  const addBtn = $("addCategory");
  if (addBtn) addBtn.onclick = () => {
    const v = ($("newCategory").value || "").trim();
    if (!v) return;
    config.categories.push(v);
    $("newCategory").value = "";
    saveConfig(config);
    renderConfig();
    pushCloudConfig(config.categories);
    if (!$("log").classList.contains("hidden")) renderLogInputs();
  };

  const saveBtn = $("saveConfig");
  if (saveBtn) saveBtn.onclick = () => {
    config.categories = config.categories.map(c => c.trim()).filter(Boolean);
    saveConfig(config);
    pushCloudConfig(config.categories);
    if (!$("log").classList.contains("hidden")) renderLogInputs();
    toast("Config saved ✓");
  };
}

// ---------- LOG UI ----------
function renderLogInputs() {
  const wrap = $("logInputs"); if (!wrap) return;
  wrap.innerHTML = "";
  (config.categories || []).forEach(cat => {
    const row = document.createElement("div"); row.className = "row";
    const label = document.createElement("label"); label.style.width = "100%";
    label.innerHTML = `<div class="muted" style="margin-bottom:4px">${cat}</div>`;
    const input = document.createElement("input");
    input.type = "number"; input.min = "0"; input.step = "0.25"; input.placeholder = "Hours";
    input.className = "hourInput"; input.dataset.label = cat;
    input.addEventListener("input", updateDailyTotal);
    label.appendChild(input); row.appendChild(label); wrap.appendChild(row);
  });
  updateDailyTotal();
}
function updateDailyTotal() {
  let total = 0;
  document.querySelectorAll(".hourInput").forEach(inp => total += parseFloat(inp.value) || 0);
  total += parseFloat($("customHours")?.value || 0);
  const td = $("dailyTotal"); if (td) td.textContent = `Total: ${total.toFixed(2)}h`;
}
function bindLogInputs() {
  $("customHours")?.addEventListener("input", updateDailyTotal);
  $("customLabel")?.addEventListener("input", updateDailyTotal);

  $("submitDay")?.addEventListener("click", async () => {
    const date = ($("entryDate")?.value) || todayStr();
    const entries = [];
    document.querySelectorAll(".hourInput").forEach(inp => {
      const val = parseFloat(inp.value);
      if (val && val > 0) entries.push({ label: inp.dataset.label, hours: val });
    });
    const cLabel = ($("customLabel")?.value || "").trim();
    const cHours = parseFloat($("customHours")?.value);
    if (cLabel && cHours && cHours > 0) entries.push({ label: cLabel, hours: cHours });

    const logs = loadLogs().filter(l => l.date !== date);
    logs.push({ date, entries });
    logs.sort((a,b) => a.date.localeCompare(b.date));
    saveLogs(logs);

    await pushToCloud({ date, entries });

    document.querySelectorAll(".hourInput").forEach(inp => inp.value = "");
    if ($("customLabel")) $("customLabel").value = "";
    if ($("customHours")) $("customHours").value = "";
    updateDailyTotal();
    toast("Saved ✓");
  });
}

// ---------- HISTORY ----------
function renderHistory() {
  const out = $("historyOutput");
  if (out) out.textContent = JSON.stringify(loadLogs(), null, 2);
}
function bindHistory() { $("refreshHistory")?.addEventListener("click", renderHistory); }

// ---------- VIZ ----------
function renderChart() {
  const canvas = $("chart"); if (!canvas) return;
  const logs = loadLogs();
  const ctx = canvas.getContext("2d");
  const mode = document.querySelector('input[name="vizMode"]:checked')?.value || "total";
  if (chartRef) { chartRef.destroy(); chartRef = null; }

  if (mode === "total") {
    const labels = logs.map(l => l.date);
    const totals = logs.map(l => l.entries.reduce((a,e)=> a + (e.hours||0), 0));
    chartRef = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: "Total Hours", data: totals, backgroundColor: "#4f8cff" }] },
      options: { responsive: true, scales: { y: { beginAtZero: true }}, plugins: { legend: { display:false } } }
    });
    return;
  }

  const allCats = [...new Set(logs.flatMap(l => l.entries.map(e => e.label)))];
  const labels = logs.map(l => l.date);
  const color = i => `hsl(${(i*47)%360} 70% 60%)`;
  const datasets = allCats.map((cat,i) => ({
    label: cat,
    data: logs.map(l => (l.entries.find(e => e.label===cat)?.hours) || 0),
    backgroundColor: color(i), stack: "stack1"
  }));
  chartRef = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      scales: { x:{ stacked:true }, y:{ stacked:true, beginAtZero:true } },
      plugins: { legend: { position:"bottom" } }
    }
  });
}
function bindViz() {
  document.querySelectorAll('input[name="vizMode"]')
    .forEach(r => r.addEventListener("change", renderChart));
  $("refreshViz")?.addEventListener("click", renderChart);
}

// ---------- misc ----------
function toast(text) {
  const t = $("saveToast"); if (!t) return;
  t.textContent = text; t.classList.remove("hidden");
  setTimeout(()=> t.classList.add("hidden"), 1400);
}

// ---------- init (order matters!) ----------
document.addEventListener("DOMContentLoaded", async () => {
  setSyncStatus("syncing");
  // basic bindings/UI
  bindTabs();
  bindConfigButtons();
  bindLogInputs();
  bindHistory();
  bindViz();

  if ($("entryDate")) $("entryDate").value = todayStr();

  // render immediately from local cache (fixes blank tabs)
  renderConfig();
  switchTab("log");     // show Log by default
  renderLogInputs();
  renderHistory();
  renderChart();

  // then pull cloud, update, and re-render
  const cloudCfg = await fetchCloudConfig();
  if (cloudCfg && Array.isArray(cloudCfg.categories)) {
    config = cloudCfg; saveConfig(config);
    renderConfig();
    if (!$("log").classList.contains("hidden")) renderLogInputs();
  }

  const cloudLogs = await fetchFromCloud();
  if (Array.isArray(cloudLogs)) {
    // re-render history/viz with fresh data
    if (!$("history").classList.contains("hidden")) renderHistory();
    if (!$("viz").classList.contains("hidden")) renderChart();
  }
});
