# Albion Market Toolkit ⚔️

A powerful Windows toolkit for Albion Online players. Track market prices, find profitable trade routes, calculate crafting costs, and more — all in a native Windows app.

![Theme](https://img.shields.io/badge/theme-medieval%20fantasy-gold)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Python](https://img.shields.io/badge/python-3.10%2B-green)

## Features

- 📊 **Market Dashboard** — Live prices across all 7 trade cities with buy/sell data and profit indicators
- 📈 **Price History Explorer** — Historical price charts with searchable item market (with icons + autocomplete)
- 💰 **Profit Finder** — Scan all markets for profitable item flips between cities with margin calculations
- 🔨 **Crafting Cost Calculator** — Material costs vs sell price with craft bonus support
- 🪙 **Gold Price Tracker** — Gold price trends over time with rate-limit handling
- 👁️ **Flip Watcher** — High-margin flip alerts with configurable thresholds
- 🏪 **Item Market** — 8,755+ items with icons, autocomplete, category/tier/enchant filters

## Quick Start

### Web Version
```bash
pip install -r requirements.txt
python app.py
# Open http://127.0.0.1:5000
```

### Windows Desktop App
```bash
pip install -r requirements.txt
python desktop_app.py
```

Or simply double-click `start_app.bat`.

### Build Standalone EXE
```bash
python build_exe.py
# Output: dist\AlbionToolkit.exe (18 MB, no Python required)
```

## Item Search

The item market supports enchant syntax:
Examples🔽🔽🔽
- `bow .2` — Find T4 Bow Enchant 2
- `bow@2` — Same, using @ syntax
- `bow enchant 2` — Same, using full text

## Tech Stack

- **Backend:** Python Flask
- **Frontend:** HTML/CSS/JS with Chart.js
- **Desktop:** pywebview (native Windows GUI)
- **Data:** Albion Online Data Project API

## Data Source

All market data comes from the public [Albion Online Data Project](https://www.albion-online-data.com/api/) API.

This tool is not affiliated with Albion Online or Sandbox Interactive GmbH.
