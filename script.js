// ---------- helpers & storage ----------
const $ = (id) => document.getElementById(id);
const todayStr = () => new Date().toISOString().split("T")[0];

function loadConfig() {
  return JSON.parse(
    localStorage.getItem("config") ||
      '{"categories":["Work (client)","Work (personal)","Exercise","Reading","TV"]}'
  );
}
function saveConfig(c) {
  localStorage.setItem("config", JSON.stringify(c));
}
function loadLogs() {
  return JSON.parse(localStorage.getItem("timeLog") || "[]");
}
function saveLogs(l) {
  localStorage.setItem("timeLog", JSON.stringify(l));
}

// ---------- sync indicator ----------
function setSyncStatus(status) {
  const el = $("syncStatus");
  if (!el) return;
  if (status === "synced") {
    el.textContent = "✓ Synced";
    el.className = "syncstatus synced";
  } else if (status === "offline") {
    el.textContent = "⚠️ Offline";
    el.className = "syncstatus offline";
  } else {
    el.textContent = "⏳ Syncing...";
    el.className = "syncstatus";
  }
}

// ---------- cloud sync: logs ----------
async function pushToCloud(entry) {
  try {
    await fetch("/.netlify/functions/pushEntry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    setSyncStatus("synced");
  } catch (err) {
    console.warn("Cloud push failed:", err);
    setSyncStatus("offline");
  }
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
      localStorage.setItem("config", JSON.stringify(data));
      console.log("Fetched config from cloud:", data.categories);
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories }),
    });
    setSyncStatus("synced");
  } catch (err) {
    console.warn("Cloud config push failed:", err);
    setSyncStatus("offline");
  }
}

// ---------- app state ----------
let config;
let chartRef = null;

// ---------- tabs ----------
const sections = document.querySelectorAll("section.card");
const tabBtns = document.querySelectorAll(".tabbtn");

function switchTab(name) {
  sections.forEach((s) => s.classList.add("hidden"));
  tabBtns.forEach((b) => b.classList.remove("active"));
  $(name).classList.remove("hidden");
  document.querySelector(`.tabbtn[data-tab="${name}"]`).classList.add("active");

  if (name === "log") renderLogInputs();
  if (name === "history") renderHistory();
  if (name === "viz") renderChart();
}

tabBtns.forEach((btn) =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab))
);
$("entryDate").value = todayStr();
switchTab("log"); // default landing tab

// ---------- CONFIG ----------
function renderConfig() {
  const ul = $("categoryList");
  ul.innerHTML = "";
  config.categories.forEach((cat, i) => {
    const li = document.createElement("li");
    li.draggable = true;
    li.classList.add("draggable-item");

    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = cat;
    inp.oninput = (e) => {
      config.categories[i] = e.target.value;
    };

    const del = document.createElement("button");
    del.textContent = "✕";
    del.className = "iconbtn";
    del.onclick = () => {
      config.categories.splice(i, 1);
      renderConfig();
    };

    li.appendChild(inp);
    li.appendChild(del);
    ul.appendChild(li);

    // drag logic
    li.addEventListener("dragstart", () => {
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
      const newOrder = Array.from(ul.querySelectorAll("li input")).map(
        (el) => el.value
      );
      config.categories = newOrder;
      saveConfig(config);
      pushCloudConfig(config.categories);
    });
  });

  // handle drag-over
  ul.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = ul.querySelector(".dragging");
    const afterElement = getDragAfterElement(ul, e.clientY);
    if (afterElement == null) {
      ul.appendChild(dragging);
    } else {
      ul.insertBefore(dragging, afterElement);
    }
  });
}

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll(".draggable-item:not(.dragging)")];
  return els.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

$("addCategory").onclick = () => {
  const v = $("newCategory").value.trim();
  if (!v) return;
  config.categories.push(v);
  $("newCategory").value = "";
  renderConfig();
};

$("saveConfig").onclick = () => {
  config.categories = config.categories.map((c) => c.trim()).filter(Boolean);
  saveConfig(config);
  pushCloudConfig(config.categories);
  if (!$("log").classList.contains("hidden")) renderLogInputs();
  toast("Config saved ✓");
};

// ---------- LOG ----------
function renderLogInputs() {
  const wrap = $("logInputs");
  wrap.innerHTML = "";
  config.categories.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "row";
    const label = document.createElement("label");
    label.style.width = "100%";
    label.innerHTML = `<div class="muted" style="margin-bottom:4px">${cat}</div>`;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.25";
    input.placeholder = "Hours";
    input.className = "hourInput";
    input.dataset.label = cat;
    input.addEventListener("input", updateDailyTotal);
    label.appendChild(input);
    row.appendChild(label);
    wrap.appendChild(row);
  });
  updateDailyTotal();
}

function updateDailyTotal() {
  let total = 0;
  document
    .querySelectorAll(".hourInput")
    .forEach((inp) => (total += parseFloat(inp.value) || 0));
  total += parseFloat($("customHours").value) || 0;
  $("dailyTotal").textContent = `Total: ${total.toFixed(2)}h`;
}
$("customHours").addEventListener("input", updateDailyTotal);
$("customLabel").addEventListener("input", updateDailyTotal);

$("submitDay").onclick = async () => {
  const date = $("entryDate").value || todayStr();
  const entries = [];

  document.querySelectorAll(".hourInput").forEach((inp) => {
    const val = parseFloat(inp.value);
    if (val && val > 0) {
      entries.push({ label: inp.dataset.label, hours: val });
    }
  });

  const cLabel = $("customLabel").value.trim();
  const cHours = parseFloat($("customHours").value);
  if (cLabel && cHours && cHours > 0) {
    entries.push({ label: cLabel, hours: cHours });
  }

  const logs = loadLogs().filter((l) => l.date !== date);
  logs.push({ date, entries });
  logs.sort((a, b) => a.date.localeCompare(b.date));
  saveLogs(logs);

  await pushToCloud({ date, entries }); // sync to Mongo
  document.querySelectorAll(".hourInput").forEach((inp) => (inp.value = ""));
  $("customLabel").value = "";
  $("customHours").value = "";
  updateDailyTotal();
  toast("Saved ✓");
};

function toast(text) {
  const t = $("saveToast");
  t.textContent = text;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 1400);
}

// ---------- HISTORY ----------
function renderHistory() {
  $("historyOutput").textContent = JSON.stringify(loadLogs(), null, 2);
}
$("refreshHistory").onclick = renderHistory;

// ---------- VIZ ----------
$("refreshViz").onclick = () => renderChart();
document
  .querySelectorAll('input[name="vizMode"]')
  .forEach((r) => r.addEventListener("change", renderChart));

function renderChart() {
  const logs = loadLogs();
  const ctx = $("chart").getContext("2d");
  const mode = document.querySelector('input[name="vizMode"]:checked').value;

  if (chartRef) {
    chartRef.destroy();
    chartRef = null;
  }

  if (mode === "total") {
    const labels = logs.map((l) => l.date);
    const totals = logs.map((l) =>
      l.entries.reduce((a, e) => a + (e.hours || 0), 0)
    );
    chartRef = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Total Hours",
            data: totals,
            backgroundColor: "#4f8cff",
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } },
      },
    });
    return;
  }

  // by category (stacked)
  const allCats = [
    ...new Set(logs.flatMap((l) => l.entries.map((e) => e.label))),
  ];
  const labels = logs.map((l) => l.date);
  const colors = (i) => `hsl(${(i * 47) % 360} 70% 60%)`;
  const datasets = allCats.map((cat, i) => {
    const data = logs.map((l) => {
      const e = l.entries.find((e) => e.label === cat);
      return e ? e.hours : 0;
    });
    return { label: cat, data, backgroundColor: colors(i), stack: "stack1" };
  });

  chartRef = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      plugins: { legend: { position: "bottom" } },
    },
  });
}

// ---------- initial sync ----------
window.addEventListener("DOMContentLoaded", async () => {
  setSyncStatus("syncing");
  config = await fetchCloudConfig();
  if (!config || !config.categories) config = loadConfig();

  renderConfig();
  renderLogInputs();

  const cloudLogs = await fetchFromCloud();
  console.log("Synced", cloudLogs?.length || 0, "entries from cloud");
});
