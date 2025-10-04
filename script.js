// --- helpers ---
const $ = id => document.getElementById(id);
const today = new Date().toISOString().split('T')[0];

// --- localStorage ---
function loadConfig() {
  return JSON.parse(localStorage.getItem('config') || '{"categories":["Work (client)","Work (personal)","Exercise","Reading","TV"]}');
}
function saveConfig(c) { localStorage.setItem('config', JSON.stringify(c)); }
function loadLogs() { return JSON.parse(localStorage.getItem('timeLog') || '[]'); }
function saveLogs(l) { localStorage.setItem('timeLog', JSON.stringify(l)); }

// --- tab navigation ---
const tabs = document.querySelectorAll('.tab');
const buttons = document.querySelectorAll('nav button');
function switchTab(name) {
  tabs.forEach(t => t.classList.add('hidden'));
  buttons.forEach(b => b.classList.remove('active'));
  $(name).classList.remove('hidden');
  document.querySelector(`button[data-tab="${name}"]`).classList.add('active');
  if (name === 'log') renderLogInputs();
}
buttons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
switchTab('log'); // default landing tab

// --- Config tab ---
let config = loadConfig();
function renderConfig() {
  const list = $('categoryList');
  list.innerHTML = '';
  config.categories.forEach((cat, i) => {
    const li = document.createElement('li');
    li.textContent = cat;
    const remove = document.createElement('button');
    remove.textContent = 'x';
    remove.style.marginLeft = '1em';
    remove.onclick = () => { config.categories.splice(i, 1); renderConfig(); };
    li.appendChild(remove);
    list.appendChild(li);
  });
}
renderConfig();

$('addCategory').onclick = () => {
  const val = $('newCategory').value.trim();
  if (val) {
    config.categories.push(val);
    $('newCategory').value = '';
    renderConfig();
  }
};
$('saveConfig').onclick = () => { saveConfig(config); alert('Config saved!'); };

// --- Log tab ---
function renderLogInputs() {
  const container = $('logInputs');
  container.innerHTML = '';
  config.categories.forEach(cat => {
    const div = document.createElement('div');
    div.innerHTML = `<label>${cat}: <input type="number" id="hours_${cat}" min="0" step="0.25" class="hourInput" /></label>`;
    container.appendChild(div);
  });
  addLiveTotalListener();
}

function addLiveTotalListener() {
  const updateTotal = () => {
    let total = 0;
    document.querySelectorAll('.hourInput').forEach(inp => total += parseFloat(inp.value) || 0);
    total += parseFloat($('customHours').value) || 0;
    $('dailyTotal').textContent = `Total: ${total.toFixed(2)}h`;
  };
  document.querySelectorAll('.hourInput').forEach(inp => inp.addEventListener('input', updateTotal));
  $('customHours').addEventListener('input', updateTotal);
  $('customLabel').addEventListener('input', updateTotal);
}

$('submitDay').onclick = () => {
  const entries = [];
  config.categories.forEach(cat => {
    const val = parseFloat($(`hours_${cat}`)?.value || 0);
    if (val > 0) entries.push({ label: cat, hours: val });
  });
  const customLabel = $('customLabel').value.trim();
  const customHours = parseFloat($('customHours').value);
  if (customLabel && customHours > 0) entries.push({ label: customLabel, hours: customHours });

  const logs = loadLogs();
  logs.push({ date: today, entries });
  saveLogs(logs);
  alert('Day saved!');
  $('customLabel').value = '';
  $('customHours').value = '';
  renderLogInputs();
};

// --- History tab ---
$('refreshHistory').onclick = renderHistory;
function renderHistory() {
  const logs = loadLogs();
  $('historyOutput').textContent = JSON.stringify(logs, null, 2);
}

// --- Viz tab ---
$('refreshViz').onclick = () => renderChart();

function renderChart() {
  const logs = loadLogs();
  const ctx = $('chart').getContext('2d');
  const mode = document.querySelector('input[name="vizMode"]:checked').value;

  let data;
  if (mode === 'total') {
    data = {
      labels: logs.map(l => l.date),
      datasets: [{
        label: 'Total Hours',
        data: logs.map(l => l.entries.reduce((a, e) => a + e.hours, 0)),
        backgroundColor: '#0077ff'
      }]
    };
  } else {
    // by category
    const cats = [...new Set(logs.flatMap(l => l.entries.map(e => e.label)))];
    const grouped = cats.map(cat => logs.map(l => {
      const e = l.entries.find(e => e.label === cat);
      return e ? e.hours : 0;
    }));
    data = {
      labels: logs.map(l => l.date),
      datasets: cats.map((cat, i) => ({
        label: cat,
        data: grouped[i],
        backgroundColor: `hsl(${i * 50 % 360}, 70%, 60%)`
      }))
    };
  }

  if (window._chart) window._chart.destroy();
  window._chart = new Chart(ctx, {
    type: 'bar',
    data,
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}
