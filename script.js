// --- helpers ---
const $ = id => document.getElementById(id);
const today = new Date().toISOString().split('T')[0];

// --- localStorage management ---
function loadConfig() {
  return JSON.parse(localStorage.getItem('config') || '{"categories":["Work (client)","Work (personal)","Exercise","Reading","TV"]}');
}

function saveConfig(config) {
  localStorage.setItem('config', JSON.stringify(config));
}

function loadLogs() {
  return JSON.parse(localStorage.getItem('timeLog') || '[]');
}

function saveLogs(logs) {
  localStorage.setItem('timeLog', JSON.stringify(logs));
}

// --- UI state ---
const tabs = document.querySelectorAll('.tab');
document.querySelectorAll('nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(tab => tab.classList.add('hidden'));
    $(btn.dataset.tab).classList.remove('hidden');
    if (btn.dataset.tab === 'log') renderLogInputs();
  });
});

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
    remove.onclick = () => {
      config.categories.splice(i, 1);
      renderConfig();
    };
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

$('saveConfig').onclick = () => {
  saveConfig(config);
  alert('Config saved!');
};

// --- Log tab ---
function renderLogInputs() {
  const container = $('logInputs');
  container.innerHTML = '';
  config.categories.forEach(cat => {
    const div = document.createElement('div');
    div.innerHTML = `<label>${cat}: <input type="number" id="hours_${cat}" min="0" step="0.25" /></label>`;
    container.appendChild(div);
  });
}

$('submitDay').onclick = async () => {
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

  // Optional MongoDB sync
  /*
  await fetch('/.netlify/functions/pushEntry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: today, entries })
  });
  */

  alert('Day saved!');
  $('customLabel').value = '';
  $('customHours').value = '';
  renderLogInputs();
};

// --- Viz tab ---
$('refreshViz').onclick = () => renderChart();

function renderChart() {
  const logs = loadLogs();
  const ctx = $('chart').getContext('2d');
  const totals = logs.map(l => ({
    date: l.date,
    total: l.entries.reduce((a, e) => a + e.hours, 0)
  }));

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: totals.map(t => t.date),
      datasets: [
        {
          label: 'Total Hours',
          data: totals.map(t => t.total),
          backgroundColor: '#4e79a7'
        }
      ]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
}
