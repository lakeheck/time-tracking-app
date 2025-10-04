// ---------- helpers & storage ----------
const $ = (id) => document.getElementById(id);
const todayStr = () => new Date().toISOString().split("T")[0];

function loadConfig() {
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

// ---------- cloud sync ----------
async function pushToCloud(entry) {
  try {
    await fetch("/.netlify/functions/pushEntry", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    setSyncStatus("synced");
  } catch { setSyncStatus("offline"); }
}

async function fetchFromCloud() {
  try {
    const res = await fetch("/.netlify/functions/fetchLogs");
    const data = await res.json();
    if (Array.isArray(data)) saveLogs(data);
    setSyncStatus("synced");
    return data;
  } catch { setSyncStatus("offline"); return loadLogs(); }
}

async function fetchCloudConfig() {
  try {
    const res = await fetch("/.netlify/functions/config");
    const data = await res.json();
    if (data && Array.isArray(data.categories)) {
      saveConfig(data);
      setSyncStatus("synced");
      return data;
    }
  } catch { setSyncStatus("offline"); }
  return loadConfig();
}

async function pushCloudConfig(categories) {
  try {
    await fetch("/.netlify/functions/config", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories }),
    });
    setSyncStatus("synced");
  } catch { setSyncStatus("offline"); }
}

// ---------- app state ----------
let config = loadConfig();
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
document.querySelectorAll(".tabbtn").forEach(btn =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab))
);
$("entryDate").value = todayStr();
switchTab("log");

// ---------- CONFIG ----------
function renderConfig() {
  const ul = $("categoryList");
  ul.innerHTML = "";
  config.categories.forEach((cat, i) => {
    const li = document.createElement("li");
    const inp = document.createElement("input");
    inp.type = "text"; inp.value = cat;
    inp.oninput = (e) => { config.categories[i] = e.target.value; };
    const del = document.createElement("button");
    del.textContent = "✕"; del.className = "iconbtn";
    del.onclick = () => { config.categories.splice(i,1); renderConfig(); };
    li.append(inp, del); ul.append(li);
  });
}
$("addCategory").onclick = () => {
  const v = $("newCategory").value.trim(); if (!v) return;
  config.categories.push(v); $("newCategory").value = "";
  saveConfig(config); pushCloudConfig(config.categories);
  renderConfig(); renderLogInputs();
};
$("saveConfig").onclick = () => {
  config.categories = config.categories.map(c=>c.trim()).filter(Boolean);
  saveConfig(config); pushCloudConfig(config.categories);
  renderConfig(); renderLogInputs(); toast("Config saved ✓");
};

// ---------- LOG ----------
function renderLogInputs() {
  const wrap = $("logInputs"); wrap.innerHTML = "";
  config.categories.forEach(cat => {
    const row = document.createElement("div"); row.className = "row";
    const label = document.createElement("label");
    label.innerHTML = `<div class="muted">${cat}</div>`;
    const input = document.createElement("input");
    input.type = "number"; input.min="0"; input.step="0.25";
    input.placeholder="Hours"; input.className="hourInput";
    input.dataset.label = cat; input.addEventListener("input", updateDailyTotal);
    label.appendChild(input); row.appendChild(label); wrap.appendChild(row);
  });
  updateDailyTotal();
}
function updateDailyTotal() {
  let total = 0;
  document.querySelectorAll(".hourInput").forEach(inp => total += parseFloat(inp.value)||0);
  total += parseFloat($("customHours")?.value||0);
  $("dailyTotal").textContent = `Total: ${total.toFixed(2)}h`;
}
$("customHours").addEventListener("input", updateDailyTotal);
$("customLabel").addEventListener("input", updateDailyTotal);

$("submitDay").onclick = async () => {
  const date = $("entryDate").value || todayStr();
  const entries = [];

  // include all categories even if blank → 0
  document.querySelectorAll(".hourInput").forEach(inp => {
    const val = parseFloat(inp.value);
    entries.push({ label: inp.dataset.label, hours: val || 0 });
  });

  const cLabel = $("customLabel").value.trim();
  const cHours = parseFloat($("customHours").value);
  if (cLabel) entries.push({ label: cLabel, hours: cHours || 0 });

  const logs = loadLogs().filter(l => l.date !== date);
  logs.push({ date, entries });
  logs.sort((a,b)=>a.date.localeCompare(b.date));
  saveLogs(logs);
  await pushToCloud({ date, entries });

  document.querySelectorAll(".hourInput").forEach(inp => inp.value="");
  $("customLabel").value=""; $("customHours").value="";
  updateDailyTotal(); toast("Saved ✓");
};

// ---------- HISTORY ----------
function renderHistory() {
  const out = $("historyOutput"); const logs = loadLogs();
  const last = logs.slice(-20);
  out.innerHTML = "";
  last.forEach(l => {
    const line = document.createElement("div");
    const summary = l.entries.map(e=>`${e.label}: ${e.hours}`).join("  ");
    line.textContent = `${l.date} → ${summary}`;
    out.appendChild(line);
  });
}
$("refreshHistory").onclick = renderHistory;

// ---------- VIZ ----------
function renderChart() {
  const logs = loadLogs();
  const ctx = $("chart").getContext("2d");
  const mode = document.querySelector('input[name="vizMode"]:checked').value;

  // read date range
  const start = $("vizStart")?.value;
  const end = $("vizEnd")?.value;
  let filtered = logs;
  if (start || end) {
    filtered = logs.filter(l => {
      if (start && l.date < start) return false;
      if (end && l.date > end) return false;
      return true;
    });
  }

  if (chartRef) { chartRef.destroy(); chartRef = null; }
  if (!filtered.length) return;

  // compute daily averages
  const days = filtered.length;
  if (mode === "total") {
    const labels = filtered.map(l=>l.date);
    const totals = filtered.map(l=>l.entries.reduce((a,e)=>a+(e.hours||0),0)/1);
    const avg = (totals.reduce((a,b)=>a+b,0)/days).toFixed(2);
    chartRef = new Chart(ctx,{
      type:"bar",
      data:{labels,datasets:[{label:`Avg ${avg}h/day`,data:totals,backgroundColor:"#4f8cff"}]},
      options:{responsive:true,scales:{y:{beginAtZero:true}},plugins:{legend:{display:true}}}
    });
    return;
  }

  // by category stacked average
  const allCats = [...new Set(filtered.flatMap(l=>l.entries.map(e=>e.label)))];
  const labels = filtered.map(l=>l.date);
  const color = i=>`hsl(${(i*47)%360} 70% 60%)`;
  const datasets = allCats.map((cat,i)=>{
    const data = filtered.map(l=>{
      const e = l.entries.find(e=>e.label===cat);
      return e?e.hours:0;
    });
    return {label:cat,data,backgroundColor:color(i),stack:"stack1"};
  });
  chartRef = new Chart(ctx,{
    type:"bar",data:{labels,datasets},
    options:{responsive:true,
      scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}},
      plugins:{legend:{position:"bottom"}}
    }
  });
}
$("refreshViz").onclick = renderChart;
document.querySelectorAll('input[name="vizMode"]').forEach(r=>r.addEventListener("change",renderChart));

// ---------- misc ----------
function toast(text){const t=$("saveToast");t.textContent=text;t.classList.remove("hidden");setTimeout(()=>t.classList.add("hidden"),1400);}

// ---------- INIT ----------
window.addEventListener("DOMContentLoaded", async ()=>{
  renderConfig(); renderLogInputs(); renderHistory();
  setSyncStatus("syncing");
  config = await fetchCloudConfig(); renderConfig(); renderLogInputs();
  await fetchFromCloud(); setSyncStatus("synced");
});
