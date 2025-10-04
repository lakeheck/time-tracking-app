## 🕒 Minimal Time Tracker

A lightweight, browser-based daily time tracker built with **vanilla JavaScript**, **localStorage**, and **Chart.js**.
Designed for ultra-fast daily logging — configurable categories, daily totals, and quick visual feedback — all running client-side and deployable on **Netlify** in under 5 minutes.

---

### 🚀 Quick Start

1. **Clone or download this repo**

   ```bash
   git clone https://github.com/<yourname>/time-tracker.git
   cd time-tracker
   ```

2. **Deploy instantly**

   * Go to [https://app.netlify.com/drop](https://app.netlify.com/drop)
   * Drag the entire `time-tracker` folder into the upload area
   * Wait for deployment to finish
   * Your tracker is live at `https://yourname.netlify.app`

   *(Alternatively, serve locally with any static server: `python -m http.server`)*

---

### 🧩 Features

* **In-App Config** — add, remove, or rename default categories
* **Simple Daily Log** — numeric entry boxes for each category, plus one custom category input
* **Live Daily Total** — automatically sums hours as you type
* **Local Persistence** — saves to `localStorage` (no backend required)
* **Data Viz Tab** — minimal Chart.js bar graph showing total hours per day
* **Zero Dependencies** — no build tools, frameworks, or setup

---

### 🗂 Folder Structure

```
time-tracker/
│
├── index.html      # UI structure (3 tabs: Config, Log, Viz)
├── style.css       # Basic layout + styling
└── script.js       # App logic, localStorage, and chart rendering
```

---

### 🧱 How It Works

* **Config Tab**

  * Displays your default activity list.
  * Categories are stored in `localStorage.config`.
  * Click “Add” or “Remove,” then “Save Config.”

* **Log Tab**

  * Auto-loads categories as numeric inputs.
  * Add hours for each, plus one freeform category if needed.
  * See the live total update as you type.
  * Click “Submit Day” to append the day’s log to `localStorage.timeLog`.

* **Viz Tab**

  * Displays total hours per day.
  * Click “Refresh” to update after new entries.

---

### 🧠 Data Format

All data is stored locally in your browser:

```json
[
  {
    "date": "2025-10-04",
    "entries": [
      {"label": "Work (client)", "hours": 4},
      {"label": "Exercise", "hours": 2},
      {"label": "Reading", "hours": 1}
    ]
  }
]
```

You can export it manually via browser dev tools:

```js
copy(localStorage.getItem('timeLog'))
```

---

### ⚙️ Customization Ideas

* Change default categories in `script.js` (`loadConfig()` fallback).
* Modify the chart style in the `renderChart()` function.
* Add weekly averages or per-category summaries.
* (Optional) Add a serverless backend later via Netlify Functions or Supabase.

---

### 🧹 Resetting Data

To clear stored data:

```js
localStorage.removeItem('timeLog');
localStorage.removeItem('config');
```

---

### 🪄 Roadmap

* [ ] “Last 7 days average” display
* [ ] CSV export button
* [ ] Color themes for categories
* [ ] Optional cloud sync (Supabase / MongoDB)

---

### 🧑‍💻 Author

Built by **Lake Heckaman** (2025)
For personal creative productivity tracking.
MIT Open Source License

---
