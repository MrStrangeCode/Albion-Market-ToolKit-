/**
 * Albion Online Toolkit - Frontend App
 */

// --- State ---
let itemsData = {};
let allItemsFlat = {};
let charts = { price: null, gold: null };

// --- Helpers ---
function getServer() {
    return document.getElementById('server-select').value;
}

function formatNumber(num) {
    if (num === null || num === undefined || num === 0) return '-';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
}

function formatDate(dateStr) {
    if (!dateStr || dateStr.startsWith('0001')) return 'No data';
    return new Date(dateStr).toLocaleString();
}

function getTierColor(itemId) {
    if (itemId.startsWith('T8')) return '#d4a03a';
    if (itemId.startsWith('T7')) return '#a87acc';
    if (itemId.startsWith('T6')) return '#6a9fd4';
    if (itemId.startsWith('T5')) return '#6db85a';
    if (itemId.startsWith('T4')) return '#b8a88a';
    return '#8a7a62';
}

async function apiGet(path, params = {}) {
    const server = getServer();
    params.server = server;
    const qs = new URLSearchParams(params).toString();
    const resp = await fetch(`${path}?${qs}`);
    return resp.json();
}

// --- Navigation ---
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const page = item.dataset.page;
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        document.getElementById(`page-${page}`).classList.add('active');

        // Lazy load
        if (page === 'dashboard' && !dashboardLoaded) loadDashboard();
        if (page === 'history') initHistoryPage();
        if (page === 'gold') loadGoldData();
    });
});

// --- Init ---
async function init() {
    // Load items catalog
    try {
        const resp = await fetch('/api/items');
        itemsData = await resp.json();
        // Build flat lookup
        for (const [catKey, cat] of Object.entries(itemsData)) {
            for (const [itemId, itemName] of Object.entries(cat.items)) {
                allItemsFlat[itemId] = { name: itemName, category: catKey };
            }
        }
        populateItemSuggestions();
    } catch (e) {
        console.error('Failed to load items:', e);
    }

    // Load cities
    try {
        const cities = await apiGet('/api/cities');
        const citySelects = ['history-city', 'craft-buy-city', 'craft-sell-city'];
        citySelects.forEach(id => {
            const sel = document.getElementById(id);
            if (sel) {
                sel.innerHTML = cities.map(c => `<option value="${c}">${c}</option>`).join('');
            }
        });
        // Set default sell city to Caerleon
        const sellCity = document.getElementById('craft-sell-city');
        if (sellCity) sellCity.value = 'Caerleon';
    } catch (e) {
        console.error('Failed to load cities:', e);
    }

    // Load dashboard on start
    loadDashboard();
}

function populateItemSuggestions() {
    const options = Object.entries(allItemsFlat)
        .map(([id, data]) => `<option value="${id}">${data.name} (${id})</option>`)
        .join('');
    const d1 = document.getElementById('item-suggestions');
    const d2 = document.getElementById('item-suggestions-2');
    if (d1) d1.innerHTML = options;
    if (d2) d2.innerHTML = options;

    // Also populate category selectors
    populateDashboardCategory();
}

function populateDashboardCategory() {
    // Categories are already in HTML, just add items dynamically if needed
}

// ==================== DASHBOARD ====================
let dashboardLoaded = false;
let currentDashItems = [];

async function loadDashboard() {
    const category = document.getElementById('dash-category').value;
    const quality = document.getElementById('dash-quality').value;
    const items = itemsData[category];
    if (!items) return;

    const itemIds = Object.keys(items.items);
    currentDashItems = itemIds;

    const grid = document.getElementById('dashboard-grid');
    grid.innerHTML = '<div class="loading">Loading market data</div>';

    try {
        const data = await apiGet('/api/prices', {
            items: itemIds.join(','),
            cities: ['Caerleon', 'Bridgewatch', 'Fort Sterling', 'Lymhurst', 'Martlock', 'Thetford', 'Brecilien'].join(','),
            quality: quality,
        });

        if (data.error) {
            grid.innerHTML = `<div class="loading-message">Error: ${data.error}</div>`;
            return;
        }

        // Organize by item
        const byItem = {};
        for (const entry of data) {
            if (!byItem[entry.item_id]) byItem[entry.item_id] = [];
            byItem[entry.item_id].push(entry);
        }

        let html = '';
        for (const [itemId, itemName] of Object.entries(items.items)) {
            const entries = byItem[itemId];
            html += renderDashboardCard(itemId, itemName, entries);
        }

        grid.innerHTML = html;
        dashboardLoaded = true;
    } catch (e) {
        grid.innerHTML = `<div class="loading-message">Failed to load: ${e.message}</div>`;
    }
}

function renderDashboardCard(itemId, itemName, entries) {
    const tierColor = getTierColor(itemId);
    let cardHtml = `<div class="market-card">`;
    cardHtml += `<div class="item-name" style="color:${tierColor}">${itemName}</div>`;
    cardHtml += `<div class="item-id">${itemId}</div>`;

    if (!entries || entries.length === 0) {
        cardHtml += `<div class="no-data">No market data available</div>`;
        cardHtml += `</div>`;
        return cardHtml;
    }

    // Find best buy (lowest sell_min) and best sell (highest buy_max)
    let bestBuyCity = null, bestSellCity = null;
    let bestBuyPrice = Infinity, bestSellPrice = 0;

    for (const e of entries) {
        const sellMin = e.sell_price_min || 0;
        const buyMax = e.buy_price_max || 0;
        if (sellMin > 0 && sellMin < bestBuyPrice) {
            bestBuyPrice = sellMin;
            bestBuyCity = e.city;
        }
        if (buyMax > 0 && buyMax > bestSellPrice) {
            bestSellPrice = buyMax;
            bestSellCity = e.city;
        }
    }

    // Show each city
    // Sort: show best buy first, then best sell, then rest
    const sorted = [...entries].sort((a, b) => {
        if (a.city === bestBuyCity) return -1;
        if (b.city === bestBuyCity) return 1;
        return 0;
    });

    for (const e of sorted) {
        const sellMin = e.sell_price_min || 0;
        const buyMax = e.buy_price_max || 0;
        let cityClass = 'city-name';
        if (e.city === bestBuyCity) cityClass += ' best-buy';
        if (e.city === bestSellCity) cityClass += ' best-sell';

        cardHtml += `<div class="price-row">`;
        cardHtml += `<span class="${cityClass}">${e.city}</span>`;
        cardHtml += `<span>`;
        if (sellMin > 0) cardHtml += `<span class="price-value sell">S:${formatNumber(sellMin)}</span> `;
        if (buyMax > 0) cardHtml += `<span class="price-value buy">B:${formatNumber(buyMax)}</span>`;
        if (sellMin === 0 && buyMax === 0) cardHtml += `<span class="no-data">-</span>`;
        cardHtml += `</span></div>`;
    }

    // Profit badge
    if (bestBuyCity && bestSellCity && bestBuyCity !== bestSellCity && bestBuyPrice > 0 && bestSellPrice > 0) {
        const profit = bestSellPrice - bestBuyPrice;
        const margin = (profit / bestBuyPrice * 100).toFixed(1);
        const badgeClass = profit > 0 ? 'profit-positive' : 'profit-negative';
        cardHtml += `<span class="profit-badge ${badgeClass}">${profit > 0 ? '+' : ''}${formatNumber(profit)} (${margin}%)</span>`;
    }

    cardHtml += `</div>`;
    return cardHtml;
}

document.getElementById('dash-category')?.addEventListener('change', loadDashboard);
document.getElementById('dash-quality')?.addEventListener('change', loadDashboard);
document.getElementById('refresh-dashboard')?.addEventListener('click', loadDashboard);

// ==================== PRICE HISTORY ====================
function initHistoryPage() {
    if (window.historyInit) return;
    window.historyInit = true;
    document.getElementById('history-fetch-btn').addEventListener('click', loadHistory);
}

async function loadHistory() {
    const itemInput = document.getElementById('history-item-input').value.trim().toUpperCase();
    const city = document.getElementById('history-city').value;
    const days = parseInt(document.getElementById('history-range').value);
    const quality = document.getElementById('history-quality').value;

    if (!itemInput) {
        alert('Please select an item using the 🔍 search button');
        return;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
        const data = await apiGet('/api/charts', {
            items: itemInput,
            cities: city,
            quality: quality,
            time_scale: '24',
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
        });

        if (data.error) {
            var container = document.querySelector('#page-history .chart-container');
            if (container) {
                container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);">' +
                    '<p style="font-size:1.2em;margin-bottom:8px;">⚠️ Failed to load price history</p>' +
                    '<p>' + data.error + '</p>' +
                    '<p style="margin-top:12px;font-size:0.85em;">The Albion API may be rate-limiting requests. Please wait a moment and try again.</p>' +
                    '<button class="btn btn-primary" onclick="loadHistory()" style="margin-top:16px;">Retry</button>' +
                    '</div>';
                if (charts.price) { charts.price.destroy(); charts.price = null; }
                document.getElementById('history-stats').style.display = 'none';
                return;
            }
            alert('Error: ' + data.error);
            return;
        }

        // Check if data is empty
        if (!data || (Array.isArray(data) && data.length === 0)) {
            alert('No historical data available for this item. The item may not have been traded recently, or the API may be temporarily unavailable.');
            return;
        }

        renderPriceChart(data, itemInput, city);
        renderHistoryStats(data);
    } catch (e) {
        alert('Failed to load history: ' + e.message);
    }
}

function renderPriceChart(data, itemId, city) {
    const ctx = document.getElementById('price-chart');
    if (!ctx) return;

    if (charts.price) charts.price.destroy();

    // Handle different API response formats:
    // charts endpoint: { data: { timestamps: [], prices_avg: [], item_count: [] } }
    // history endpoint: { data: [{avg_price, item_count, timestamp}, ...] }
    // flat format: [{ sell_price_min, buy_price_max, timestamp, city, item_id }, ...]
    let flatData = [];

    if (data.length > 0 && data[0].data && data[0].data.timestamps) {
        // Charts endpoint format (parallel arrays)
        for (const entry of data) {
            if (entry.data && entry.data.timestamps) {
                const cityName = entry.location || entry.city;
                for (let i = 0; i < entry.data.timestamps.length; i++) {
                    flatData.push({
                        timestamp: entry.data.timestamps[i],
                        avg_price: entry.data.prices_avg ? entry.data.prices_avg[i] : 0,
                        item_count: entry.data.item_count ? entry.data.item_count[i] : 0,
                        sell_price_min: entry.data.prices_avg ? entry.data.prices_avg[i] : 0,
                        buy_price_max: entry.data.prices_max ? entry.data.prices_max[i] : 0,
                        item_id: entry.item_id,
                        city: cityName,
                        quality: entry.quality,
                    });
                }
            }
        }
    } else if (data.length > 0 && data[0].data && Array.isArray(data[0].data)) {
        // History endpoint format (array of objects)
        for (const entry of data) {
            if (entry.data) {
                for (const point of entry.data) {
                    flatData.push({
                        ...point,
                        item_id: entry.item_id,
                        city: entry.location || entry.city,
                        quality: entry.quality,
                    });
                }
            }
        }
    } else {
        // Already flat format
        flatData = data;
    }

    // Filter for the requested city and item
    const cityData = flatData.filter(d => {
        const cityMatch = !city || d.city === city || d.location === city;
        const itemMatch = !itemId || d.item_id === itemId;
        return cityMatch && itemMatch;
    });
    const labels = [];
    const sellPrices = [];
    const buyPrices = [];

    for (const entry of cityData) {
        // History data uses timestamp
        const ts = entry.timestamp || entry.sell_price_min_date;
        if (ts) {
            labels.push(new Date(ts).toLocaleDateString());
            // For history data, use avg_price; for live data, use sell_price_min/buy_price_max
            sellPrices.push(entry.avg_price || entry.sell_price_min || 0);
            buyPrices.push(entry.buy_price_max || 0);
        }
    }

    if (labels.length === 0) {
        // Try using chart endpoint format (fallback)
        for (let i = 0; i < flatData.length; i++) {
            const d = flatData[i];
            const itemMatch = !itemId || d.item_id === itemId || itemId.includes(d.item_id);
            const cityMatch = !city || d.city === city || city === 'All';
            if (itemMatch && cityMatch) {
                const ts = d.timestamp || d.sell_price_min_date;
                if (ts) {
                    labels.push(new Date(ts).toLocaleDateString());
                    sellPrices.push(d.avg_price || d.sell_price_min || 0);
                    buyPrices.push(d.buy_price_max || 0);
                }
            }
        }
    }

    const itemName = allItemsFlat[itemId]?.name || itemId;

    charts.price = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `Sell Min (${itemName})`,
                    data: sellPrices,
                    borderColor: '#c4882a',
                    backgroundColor: 'rgba(196, 136, 42, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                },
                {
                    label: `Buy Max (${itemName})`,
                    data: buyPrices,
                    borderColor: '#5ab8a8',
                    backgroundColor: 'rgba(90, 184, 168, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${itemName} - ${city}`,
                    color: '#e6edf3',
                    font: { size: 14 }
                },
                legend: {
                    labels: { color: '#8b949e' }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ctx.dataset.label + ': ' + formatNumber(ctx.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#6e7681', maxTicksLimit: 15 },
                    grid: { color: 'rgba(48, 54, 61, 0.5)' }
                },
                y: {
                    ticks: {
                        color: '#6e7681',
                        callback: function(value) { return formatNumber(value); }
                    },
                    grid: { color: 'rgba(48, 54, 61, 0.5)' }
                }
            }
        }
    });
}

function renderHistoryStats(data) {
    const statsDiv = document.getElementById('history-stats');
    statsDiv.style.display = 'grid';

    let priceValues;
    if (data.length > 0 && data[0].data && data[0].data.timestamps) {
        // Charts endpoint format (parallel arrays)
        priceValues = [];
        for (const entry of data) {
            if (entry.data && entry.data.prices_avg) {
                priceValues.push(...entry.data.prices_avg.filter(p => p > 0));
            }
        }
    } else if (data.length > 0 && data[0].data && Array.isArray(data[0].data)) {
        // History endpoint format (array of objects)
        priceValues = [];
        for (const entry of data) {
            if (entry.data) {
                for (const point of entry.data) {
                    if (point.avg_price > 0) priceValues.push(point.avg_price);
                }
            }
        }
    } else {
        // Flat format
        priceValues = data.map(d => d.sell_price_min || d.avg_price).filter(p => p > 0);
    }
    const allPrices = priceValues;
    if (allPrices.length === 0) {
        statsDiv.style.display = 'none';
        return;
    }

    const latest = allPrices[allPrices.length - 1];
    const low = Math.min(...allPrices);
    const high = Math.max(...allPrices);
    const avg = Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);

    document.getElementById('stat-latest').textContent = formatNumber(latest);
    document.getElementById('stat-low').textContent = formatNumber(low);
    document.getElementById('stat-high').textContent = formatNumber(high);
    document.getElementById('stat-avg').textContent = formatNumber(avg);
}

// ==================== PROFIT FINDER ====================
document.getElementById('scan-profit-btn')?.addEventListener('click', scanProfit);

async function scanProfit() {
    const category = document.getElementById('profit-category').value;
    const quality = document.getElementById('profit-quality').value;
    const minProfit = document.getElementById('profit-min').value;

    let itemIds;
    if (category === 'all') {
        itemIds = Object.keys(allItemsFlat).join(',');
    } else {
        const cat = itemsData[category];
        if (!cat) return;
        itemIds = Object.keys(cat.items).join(',');
    }

    const results = document.getElementById('profit-results');
    results.innerHTML = '<div class="loading">Scanning markets for profit opportunities</div>';

    try {
        const data = await apiGet('/api/profit-scan', {
            items: itemIds,
            quality: quality,
            min_profit: minProfit,
        });

        if (data.error) {
            results.innerHTML = `<div class="loading-message">Error: ${data.error}</div>`;
            return;
        }

        if (data.length === 0) {
            results.innerHTML = `<div class="loading-message">No profitable opportunities found with current filters. Try lowering min profit or changing quality.</div>`;
            return;
        }

        let html = `<table class="data-table"><thead><tr>
            <th>Item</th><th>Buy City</th><th>Buy Price</th><th>Sell City</th><th>Sell Price</th><th>Profit</th><th>Margin</th>
        </tr></thead><tbody>`;

        for (const flip of data.slice(0, 50)) { // Top 50
            const tierColor = getTierColor(flip.item_id);
            html += `<tr>
                <td style="color:${tierColor}">${flip.item_name}</td>
                <td class="profit-buy">${flip.buy_city}</td>
                <td>${formatNumber(flip.buy_price)}</td>
                <td class="profit-sell">${flip.sell_city}</td>
                <td>${formatNumber(flip.sell_price)}</td>
                <td class="profit-val">+${formatNumber(flip.profit)}</td>
                <td class="profit-val">${flip.margin}%</td>
            </tr>`;
        }

        html += `</tbody></table>`;
        html += `<p style="margin-top:10px;color:var(--text-muted);font-size:0.8em;">Showing top ${Math.min(data.length, 50)} of ${data.length} opportunities found.</p>`;
        results.innerHTML = html;
    } catch (e) {
        results.innerHTML = `<div class="loading-message">Error: ${e.message}</div>`;
    }
}

// ==================== CRAFTING CALCULATOR ====================
document.getElementById('calc-craft-btn')?.addEventListener('click', calcCrafting);

const CRAFT_RECIPES = {
    // Weapons
    "T4_2H_CLAYMORE": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T5_2H_CLAYMORE": { tier: 5, type: "weapon", material: "T5_ORE", materialQty: 12, materialLevel: 1, focusReturn: 50 },
    "T6_2H_CLAYMORE": { tier: 6, type: "weapon", material: "T6_ORE", materialQty: 16, materialLevel: 1, focusReturn: 50 },
    "T7_2H_CLAYMORE": { tier: 7, type: "weapon", material: "T7_ORE", materialQty: 20, materialLevel: 1, focusReturn: 50 },
    "T8_2H_CLAYMORE": { tier: 8, type: "weapon", material: "T8_ORE", materialQty: 24, materialLevel: 1, focusReturn: 50 },
    "T4_MAIN_SWORD": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 6, materialLevel: 1, focusReturn: 50 },
    "T5_MAIN_SWORD": { tier: 5, type: "weapon", material: "T5_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_2H_AXE": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T5_2H_AXE": { tier: 5, type: "weapon", material: "T5_ORE", materialQty: 12, materialLevel: 1, focusReturn: 50 },
    "T4_MAIN_AXE": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 6, materialLevel: 1, focusReturn: 50 },
    "T4_2H_BOW": { tier: 4, type: "weapon", material: "T4_WOOD", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T5_2H_BOW": { tier: 5, type: "weapon", material: "T5_WOOD", materialQty: 12, materialLevel: 1, focusReturn: 50 },
    "T4_2H_LONGBOW": { tier: 4, type: "weapon", material: "T4_WOOD", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_2H_WARBOW": { tier: 4, type: "weapon", material: "T4_WOOD", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_MAIN_HAMMER": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 6, materialLevel: 1, focusReturn: 50 },
    "T4_2H_HAMMER": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_MAIN_MACE": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 6, materialLevel: 1, focusReturn: 50 },
    "T4_2H_MACE": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_MAIN_DAGGER": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 6, materialLevel: 1, focusReturn: 50 },
    "T4_2H_DAGGERPAIR": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_2H_SPEAR": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_2H_GLAIVE": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_2H_NATURESTAFF": { tier: 4, type: "weapon", material: "T4_WOOD", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T5_2H_NATURESTAFF": { tier: 5, type: "weapon", material: "T5_WOOD", materialQty: 12, materialLevel: 1, focusReturn: 50 },
    "T4_MAIN_FIRESTAFF": { tier: 4, type: "weapon", material: "T4_WOOD", materialQty: 6, materialLevel: 1, focusReturn: 50 },
    "T5_MAIN_FIRESTAFF": { tier: 5, type: "weapon", material: "T5_WOOD", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_MAIN_FROSTSTAFF": { tier: 4, type: "weapon", material: "T4_WOOD", materialQty: 6, materialLevel: 1, focusReturn: 50 },
    "T5_MAIN_FROSTSTAFF": { tier: 5, type: "weapon", material: "T5_WOOD", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_2H_INFERNOSTAFF": { tier: 4, type: "weapon", material: "T4_WOOD", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_2H_DUALSWORD": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 10, materialLevel: 1, focusReturn: 50 },
    "T4_2H_CLAWPAIR": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_2H_HALBERD": { tier: 4, type: "weapon", material: "T4_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },

    // Armor - Cloth
    "T4_HEAD_CLOTH_SET1": { tier: 4, type: "armor", material: "T4_FIBER", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T5_HEAD_CLOTH_SET1": { tier: 5, type: "armor", material: "T5_FIBER", materialQty: 12, materialLevel: 1, focusReturn: 50 },
    "T6_HEAD_CLOTH_SET1": { tier: 6, type: "armor", material: "T6_FIBER", materialQty: 16, materialLevel: 1, focusReturn: 50 },
    "T7_HEAD_CLOTH_SET1": { tier: 7, type: "armor", material: "T7_FIBER", materialQty: 20, materialLevel: 1, focusReturn: 50 },
    "T8_HEAD_CLOTH_SET1": { tier: 8, type: "armor", material: "T8_FIBER", materialQty: 24, materialLevel: 1, focusReturn: 50 },
    "T4_ARMOR_CLOTH_SET1": { tier: 4, type: "armor", material: "T4_FIBER", materialQty: 16, materialLevel: 1, focusReturn: 50 },
    "T5_ARMOR_CLOTH_SET1": { tier: 5, type: "armor", material: "T5_FIBER", materialQty: 24, materialLevel: 1, focusReturn: 50 },
    "T6_ARMOR_CLOTH_SET1": { tier: 6, type: "armor", material: "T6_FIBER", materialQty: 32, materialLevel: 1, focusReturn: 50 },
    "T7_ARMOR_CLOTH_SET1": { tier: 7, type: "armor", material: "T7_FIBER", materialQty: 40, materialLevel: 1, focusReturn: 50 },
    "T8_ARMOR_CLOTH_SET1": { tier: 8, type: "armor", material: "T8_FIBER", materialQty: 48, materialLevel: 1, focusReturn: 50 },
    "T4_SHOES_CLOTH_SET1": { tier: 4, type: "armor", material: "T4_FIBER", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T5_SHOES_CLOTH_SET1": { tier: 5, type: "armor", material: "T5_FIBER", materialQty: 12, materialLevel: 1, focusReturn: 50 },
    "T6_SHOES_CLOTH_SET1": { tier: 6, type: "armor", material: "T6_FIBER", materialQty: 16, materialLevel: 1, focusReturn: 50 },
    "T7_SHOES_CLOTH_SET1": { tier: 7, type: "armor", material: "T7_FIBER", materialQty: 20, materialLevel: 1, focusReturn: 50 },
    "T8_SHOES_CLOTH_SET1": { tier: 8, type: "armor", material: "T8_FIBER", materialQty: 24, materialLevel: 1, focusReturn: 50 },

    // Armor - Leather
    "T4_HEAD_LEATHER_SET1": { tier: 4, type: "armor", material: "T4_HIDE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T5_HEAD_LEATHER_SET1": { tier: 5, type: "armor", material: "T5_HIDE", materialQty: 12, materialLevel: 1, focusReturn: 50 },
    "T6_HEAD_LEATHER_SET1": { tier: 6, type: "armor", material: "T6_HIDE", materialQty: 16, materialLevel: 1, focusReturn: 50 },
    "T7_HEAD_LEATHER_SET1": { tier: 7, type: "armor", material: "T7_HIDE", materialQty: 20, materialLevel: 1, focusReturn: 50 },
    "T8_HEAD_LEATHER_SET1": { tier: 8, type: "armor", material: "T8_HIDE", materialQty: 24, materialLevel: 1, focusReturn: 50 },
    "T4_ARMOR_LEATHER_SET1": { tier: 4, type: "armor", material: "T4_HIDE", materialQty: 16, materialLevel: 1, focusReturn: 50 },
    "T5_ARMOR_LEATHER_SET1": { tier: 5, type: "armor", material: "T5_HIDE", materialQty: 24, materialLevel: 1, focusReturn: 50 },
    "T6_ARMOR_LEATHER_SET1": { tier: 6, type: "armor", material: "T6_HIDE", materialQty: 32, materialLevel: 1, focusReturn: 50 },
    "T7_ARMOR_LEATHER_SET1": { tier: 7, type: "armor", material: "T7_HIDE", materialQty: 40, materialLevel: 1, focusReturn: 50 },
    "T8_ARMOR_LEATHER_SET1": { tier: 8, type: "armor", material: "T8_HIDE", materialQty: 48, materialLevel: 1, focusReturn: 50 },
    "T4_SHOES_LEATHER_SET1": { tier: 4, type: "armor", material: "T4_HIDE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T5_SHOES_LEATHER_SET1": { tier: 5, type: "armor", material: "T5_HIDE", materialQty: 12, materialLevel: 1, focusReturn: 50 },
    "T6_SHOES_LEATHER_SET1": { tier: 6, type: "armor", material: "T6_HIDE", materialQty: 16, materialLevel: 1, focusReturn: 50 },
    "T7_SHOES_LEATHER_SET1": { tier: 7, type: "armor", material: "T7_HIDE", materialQty: 20, materialLevel: 1, focusReturn: 50 },
    "T8_SHOES_LEATHER_SET1": { tier: 8, type: "armor", material: "T8_HIDE", materialQty: 24, materialLevel: 1, focusReturn: 50 },

    // Armor - Plate
    "T4_HEAD_PLATE_SET1": { tier: 4, type: "armor", material: "T4_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T5_HEAD_PLATE_SET1": { tier: 5, type: "armor", material: "T5_ORE", materialQty: 12, materialLevel: 1, focusReturn: 50 },
    "T6_HEAD_PLATE_SET1": { tier: 6, type: "armor", material: "T6_ORE", materialQty: 16, materialLevel: 1, focusReturn: 50 },
    "T7_HEAD_PLATE_SET1": { tier: 7, type: "armor", material: "T7_ORE", materialQty: 20, materialLevel: 1, focusReturn: 50 },
    "T8_HEAD_PLATE_SET1": { tier: 8, type: "armor", material: "T8_ORE", materialQty: 24, materialLevel: 1, focusReturn: 50 },
    "T4_ARMOR_PLATE_SET1": { tier: 4, type: "armor", material: "T4_ORE", materialQty: 16, materialLevel: 1, focusReturn: 50 },
    "T5_ARMOR_PLATE_SET1": { tier: 5, type: "armor", material: "T5_ORE", materialQty: 24, materialLevel: 1, focusReturn: 50 },
    "T6_ARMOR_PLATE_SET1": { tier: 6, type: "armor", material: "T6_ORE", materialQty: 32, materialLevel: 1, focusReturn: 50 },
    "T7_ARMOR_PLATE_SET1": { tier: 7, type: "armor", material: "T7_ORE", materialQty: 40, materialLevel: 1, focusReturn: 50 },
    "T8_ARMOR_PLATE_SET1": { tier: 8, type: "armor", material: "T8_ORE", materialQty: 48, materialLevel: 1, focusReturn: 50 },
    "T4_SHOES_PLATE_SET1": { tier: 4, type: "armor", material: "T4_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T5_SHOES_PLATE_SET1": { tier: 5, type: "armor", material: "T5_ORE", materialQty: 12, materialLevel: 1, focusReturn: 50 },
    "T6_SHOES_PLATE_SET1": { tier: 6, type: "armor", material: "T6_ORE", materialQty: 16, materialLevel: 1, focusReturn: 50 },
    "T7_SHOES_PLATE_SET1": { tier: 7, type: "armor", material: "T7_ORE", materialQty: 20, materialLevel: 1, focusReturn: 50 },
    "T8_SHOES_PLATE_SET1": { tier: 8, type: "armor", material: "T8_ORE", materialQty: 24, materialLevel: 1, focusReturn: 50 },

    // Tools
    "T4_2H_PICKAXE": { tier: 4, type: "tool", material: "T4_ORE", materialQty: 6, materialLevel: 1, focusReturn: 50 },
    "T5_2H_PICKAXE": { tier: 5, type: "tool", material: "T5_ORE", materialQty: 8, materialLevel: 1, focusReturn: 50 },
    "T4_2H_AXE": { tier: 4, type: "tool", material: "T4_ORE", materialQty: 6, materialLevel: 1, focusReturn: 50 },

    // Bags (need both fiber and hide)
    "T4_BAG": { tier: 4, type: "special", materials: [
        { id: "T4_FIBER_LEVEL1", qty: 4 },
        { id: "T4_HIDE_LEVEL1", qty: 4 },
    ], focusReturn: 50 },
    "T5_BAG": { tier: 5, type: "special", materials: [
        { id: "T5_FIBER_LEVEL1", qty: 6 },
        { id: "T5_HIDE_LEVEL1", qty: 6 },
    ], focusReturn: 50 },
    "T6_BAG": { tier: 6, type: "special", materials: [
        { id: "T6_FIBER_LEVEL1", qty: 8 },
        { id: "T6_HIDE_LEVEL1", qty: 8 },
    ], focusReturn: 50 },
    "T7_BAG": { tier: 7, type: "special", materials: [
        { id: "T7_FIBER_LEVEL1", qty: 10 },
        { id: "T7_HIDE_LEVEL1", qty: 10 },
    ], focusReturn: 50 },
    "T8_BAG": { tier: 8, type: "special", materials: [
        { id: "T8_FIBER_LEVEL1", qty: 12 },
        { id: "T8_HIDE_LEVEL1", qty: 12 },
    ], focusReturn: 50 },

    // Capes
    "T4_CAPE": { tier: 4, type: "special", materials: [
        { id: "T4_FIBER_LEVEL1", qty: 2 },
    ], focusReturn: 50 },
    "T5_CAPE": { tier: 5, type: "special", materials: [
        { id: "T5_FIBER_LEVEL1", qty: 3 },
    ], focusReturn: 50 },
    "T4_CAPEITEM_FW_BRIDGEWATCH": { tier: 4, type: "special", materials: [
        { id: "T4_SOUL", qty: 1 },
    ], focusReturn: 50 },

    // Consumables
    "T4_POTION_HEAL": { tier: 4, type: "consumable", materials: [
        { id: "T4_FIBER", qty: 12 },
    ], focusReturn: 50 },
    "T5_POTION_HEAL": { tier: 5, type: "consumable", materials: [
        { id: "T5_FIBER", qty: 16 },
    ], focusReturn: 50 },
    "T4_FOOD_STEW": { tier: 4, type: "consumable", materials: [
        { id: "T4_FIBER", qty: 8 },
        { id: "T4_HIDE", qty: 4 },
    ], focusReturn: 50 },
    "T5_FOOD_STEW": { tier: 5, type: "consumable", materials: [
        { id: "T5_FIBER", qty: 12 },
        { id: "T5_HIDE", qty: 6 },
    ], focusReturn: 50 },
    "T4_FOOD_SANDWICH": { tier: 4, type: "consumable", materials: [
        { id: "T4_FIBER", qty: 12 },
        { id: "T4_HIDE", qty: 6 },
    ], focusReturn: 50 },
};

async function calcCrafting() {
    const itemId = document.getElementById('craft-item-input').value.trim().toUpperCase();
    const buyCity = document.getElementById('craft-buy-city').value;
    const sellCity = document.getElementById('craft-sell-city').value;
    const craftBonus = parseInt(document.getElementById('craft-bonus').value) || 0;

    if (!itemId) {
        alert('Please enter an Item ID');
        return;
    }

    const recipe = CRAFT_RECIPES[itemId];
    const resultsDiv = document.getElementById('craft-results');

    // Get material list
    let materialIds = [];
    if (recipe && recipe.materials) {
        materialIds = recipe.materials.map(m => m.id);
    } else if (recipe && recipe.material) {
        materialIds = [recipe.material + (recipe.materialLevel ? '_LEVEL' + recipe.materialLevel : '')];
    }

    if (materialIds.length === 0 || !recipe) {
        // Unknown recipe - try to get the item price anyway
        resultsDiv.style.display = 'block';
        document.getElementById('craft-table').querySelector('tbody').innerHTML =
            `<tr><td colspan="5">No crafting recipe in database for <strong>${itemId}</strong>. Try items like T4_BAG, T4_2H_CLAYMORE, T4_HEAD_CLOTH_SET1, T4_POTION_HEAL, etc.</td></tr>`;
        document.getElementById('craft-stats').innerHTML = '';
        return;
    }

    try {
        // Fetch material prices
        const materialData = await apiGet('/api/prices', {
            items: materialIds.join(','),
            cities: buyCity + ',' + sellCity,
            quality: '1',
        });

        // Fetch product price
        const productData = await apiGet('/api/prices', {
            items: itemId,
            cities: sellCity + ',' + buyCity,
            quality: '1',
        });

        if (materialData.error) {
            resultsDiv.innerHTML = `<div class="loading-message">API Error: ${materialData.error}</div>`;
            return;
        }

        resultsDiv.style.display = 'block';

        // Build material lookup
        const matPrices = {};
        for (const entry of materialData) {
            if (entry.city === buyCity) {
                if (!matPrices[entry.item_id] || entry.sell_price_min < matPrices[entry.item_id]) {
                    matPrices[entry.item_id] = entry.sell_price_min || 0;
                }
            }
        }

        // Calculate crafting cost
        let totalMaterialCost = 0;
        let tbody = '';

        if (recipe.materials) {
            // Multiple materials (special items)
            for (const mat of recipe.materials) {
                const unitPrice = matPrices[mat.id] || 0;
                const totalCost = unitPrice * mat.qty;
                totalMaterialCost += totalCost;
                tbody += `<tr>
                    <td>${mat.id}</td>
                    <td>${mat.id.match(/T\d/)?.[0] || '?'}</td>
                    <td>${mat.qty}</td>
                    <td>${formatNumber(unitPrice)}</td>
                    <td>${formatNumber(totalCost)}</td>
                </tr>`;
            }
        } else {
            // Single material type
            const matId = recipe.material + (recipe.materialLevel ? '_LEVEL' + recipe.materialLevel : '');
            const unitPrice = matPrices[matId] || 0;
            const totalCost = unitPrice * recipe.materialQty;
            totalMaterialCost += totalCost;
            tbody += `<tr>
                <td>${matId}</td>
                <td>T${recipe.tier}</td>
                <td>${recipe.materialQty}</td>
                <td>${formatNumber(unitPrice)}</td>
                <td>${formatNumber(totalCost)}</td>
            </tr>`;
        }

        // Apply craft bonus (resource return)
        const effectiveTotalCost = totalMaterialCost * (1 - craftBonus / 100);

        // Get product sell price
        let productSellPrice = 0;
        for (const entry of productData) {
            if (entry.city === sellCity && entry.sell_price_min > 0) {
                productSellPrice = entry.sell_price_min;
                break;
            }
        }

        // Market tax (approx 4-6% for most transactions)
        const marketTax = 0.04;
        const sellRevenue = productSellPrice * (1 - marketTax);
        const profit = sellRevenue - effectiveTotalCost;
        const margin = effectiveTotalCost > 0 ? (profit / effectiveTotalCost * 100) : 0;

        tbody += `<tfoot><tr>
            <td colspan="4">Material Cost (before bonus)</td>
            <td>${formatNumber(totalMaterialCost)}</td>
        </tr><tr>
            <td colspan="4">Craft Bonus Reduction (${craftBonus}%)</td>
            <td>-${formatNumber(totalMaterialCost - effectiveTotalCost)}</td>
        </tr><tr>
            <td colspan="4">Effective Material Cost</td>
            <td>${formatNumber(effectiveTotalCost)}</td>
        </tr></tfoot>`;

        document.getElementById('craft-table').querySelector('tbody').innerHTML = tbody;

        // Stats
        const profitClass = profit > 0 ? 'green' : 'red';
        document.getElementById('craft-stats').innerHTML = `
            <div class="stat-card">
                <span class="stat-label">Sell Price (${sellCity})</span>
                <span class="stat-value ${profit > 0 ? 'green' : ''}">${formatNumber(productSellPrice)}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">After Tax Revenue</span>
                <span class="stat-value">${formatNumber(sellRevenue)}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Total Cost</span>
                <span class="stat-value">${formatNumber(effectiveTotalCost)}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Profit</span>
                <span class="stat-value ${profitClass}">${profit > 0 ? '+' : ''}${formatNumber(profit)}</span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Margin</span>
                <span class="stat-value ${profitClass}">${margin.toFixed(1)}%</span>
            </div>
        `;
    } catch (e) {
        resultsDiv.innerHTML = `<div class="loading-message">Error: ${e.message}</div>`;
    }
}

// ==================== GOLD TRACKER ====================
document.getElementById('refresh-gold-btn')?.addEventListener('click', loadGoldData);

async function loadGoldData() {
    var days = parseInt(document.getElementById('gold-range').value);
    var count = Math.min(days * 24, 168);
    var container = document.querySelector('#page-gold .chart-container');
    var existingCanvas = document.getElementById('gold-chart');
    if (existingCanvas) existingCanvas.style.opacity = '0.4';

    for (var attempt = 0; attempt < 3; attempt++) {
        try {
            var data = await apiGet('/api/gold', { count: count.toString() });
            if (!data.error && Array.isArray(data) && data.length > 0) {
                if (existingCanvas) existingCanvas.style.opacity = '1';
                renderGoldChart(data, days);
                renderGoldStats(data);
                return;
            }
            if (attempt < 2) await new Promise(function(r) { setTimeout(r, (attempt + 1) * 5000); });
        } catch (e) {
            if (attempt < 2) await new Promise(function(r) { setTimeout(r, (attempt + 1) * 5000); });
        }
    }

    if (existingCanvas) existingCanvas.style.opacity = '1';
    if (charts.gold) { charts.gold.destroy(); charts.gold = null; }
    document.getElementById('gold-stats').style.display = 'none';
    if (container) {
        container.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted);">' +
            '<p style="font-size:1.2em;margin-bottom:8px;">⚠️ Gold data temporarily unavailable</p>' +
            '<p>The Albion API is rate-limiting requests. Please wait a moment and try again.</p>' +
            '<button class="btn btn-primary" onclick="loadGoldData()" style="margin-top:16px;" disabled id="gold-retry-btn">Retry (30s)</button>' +
            '</div>';
        setTimeout(function() { var b = document.getElementById('gold-retry-btn'); if (b) { b.disabled = false; b.textContent = 'Retry'; } }, 30000);
    }
}

function renderGoldChart(data, days) {
    const ctx = document.getElementById('gold-chart');
    if (!ctx) return;
    if (charts.gold) charts.gold.destroy();

    const labels = [];
    const prices = [];

    for (const entry of data) {
        const ts = entry.timestamp || entry.price_date;
        if (ts && entry.price > 0) {
            labels.push(new Date(ts).toLocaleDateString());
            prices.push(entry.price);
        }
    }

    // If data uses different format
    if (labels.length === 0) {
        for (const entry of data) {
            const ts = Object.keys(entry).find(k => k.includes('date') || k.includes('time'));
            const priceKey = Object.keys(entry).find(k => k.includes('price'));
            if (ts && priceKey) {
                labels.push(new Date(entry[ts]).toLocaleDateString());
                prices.push(entry[priceKey]);
            }
        }
    }

    charts.gold = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gold Price (silver)',
                data: prices,
                borderColor: '#d4a03a',
                backgroundColor: 'rgba(212, 160, 58, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Gold Price - Last ${days} Days`,
                    color: '#e6edf3',
                    font: { size: 14 }
                },
                legend: { labels: { color: '#8b949e' } },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return 'Price: ' + formatNumber(ctx.raw) + ' silver';
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#6e7681', maxTicksLimit: 15 },
                    grid: { color: 'rgba(48, 54, 61, 0.5)' }
                },
                y: {
                    ticks: {
                        color: '#6e7681',
                        callback: function(value) { return formatNumber(value); }
                    },
                    grid: { color: 'rgba(48, 54, 61, 0.5)' }
                }
            }
        }
    });
}

function renderGoldStats(data) {
    const statsDiv = document.getElementById('gold-stats');
    statsDiv.style.display = 'grid';

    const prices = data.map(d => d.price || d.price_amount).filter(p => p > 0);
    if (prices.length === 0) {
        statsDiv.style.display = 'none';
        return;
    }

    const latest = prices[0];  // API returns newest first
    const low = Math.min(...prices);
    const high = Math.max(...prices);

    document.getElementById('gold-stat-latest').textContent = formatNumber(latest);
    document.getElementById('gold-stat-low').textContent = formatNumber(low);
    document.getElementById('gold-stat-high').textContent = formatNumber(high);

    const lowIdx = prices.indexOf(low);
    const lowDate = data[lowIdx]?.timestamp || data[lowIdx]?.price_date || 'Unknown';
    document.getElementById('gold-stat-time').textContent = lowDate !== 'Unknown'
        ? new Date(lowDate).toLocaleDateString()
        : 'Unknown';
}

// ==================== FLIP WATCHER ====================
document.getElementById('watcher-scan-btn')?.addEventListener('click', scanWatcher);

async function scanWatcher() {
    const category = document.getElementById('watcher-category').value;
    const minMargin = parseInt(document.getElementById('watcher-margin').value);
    const quality = document.getElementById('watcher-quality').value;

    const cat = itemsData[category];
    if (!cat) return;

    const itemIds = Object.keys(cat.items).join(',');
    const results = document.getElementById('watcher-results');
    results.innerHTML = '<div class="loading">Scanning for high-margin flips</div>';

    try {
        const data = await apiGet('/api/profit-scan', {
            items: itemIds,
            quality: quality,
            min_profit: 100,
        });

        if (data.error) {
            results.innerHTML = `<div class="loading-message">Error: ${data.error}</div>`;
            return;
        }

        // Filter by margin
        const filtered = data.filter(d => d.margin >= minMargin);

        if (filtered.length === 0) {
            results.innerHTML = `<div class="loading-message">No flips with ${minMargin}%+ margin found. Try lowering the threshold.</div>`;
            return;
        }

        let html = `<div style="margin-bottom:10px;padding:10px;background:var(--bg-tertiary);border-radius:8px;">
            <strong style="color:var(--accent-gold)">${filtered.length}</strong> flip opportunities with <strong>${minMargin}%+</strong> margin found!
        </div>`;
        html += `<table class="data-table"><thead><tr>
            <th>Item</th><th>Buy City</th><th>Buy At</th><th>Sell To</th><th>Sell At</th><th>Profit</th><th>Margin</th>
        </tr></thead><tbody>`;

        for (const flip of filtered.slice(0, 100)) {
            const tierColor = getTierColor(flip.item_id);
            html += `<tr>
                <td style="color:${tierColor}">${flip.item_name}</td>
                <td class="profit-buy">${flip.buy_city}</td>
                <td>${formatNumber(flip.buy_price)}</td>
                <td class="profit-sell">${flip.sell_city}</td>
                <td>${formatNumber(flip.sell_price)}</td>
                <td class="profit-val">+${formatNumber(flip.profit)}</td>
                <td class="profit-val">${flip.margin}%</td>
            </tr>`;
        }

        html += `</tbody></table>`;
        results.innerHTML = html;
    } catch (e) {
        results.innerHTML = `<div class="loading-message">Error: ${e.message}</div>`;
    }
}

// ================================================================
// ITEM MARKET — Searchable item picker with icons
// ================================================================
const ICON_BASE = 'http://render.albiononline.com/v1/item/';
let allItems = [];
let marketCallback = null;
let marketSelectedItem = null;
let marketFilterCategory = '';
let marketFilterTier = '';

function openItemMarket(callback) {
    marketCallback = callback;
    marketSelectedItem = null;
    marketFilterCategory = '';
    marketFilterTier = '';
    marketFilterEnchant = '';
    document.getElementById('item-market-overlay').classList.add('active');
    var inp = document.getElementById('market-search-input');
    inp.value = '';
    inp.focus();
    renderMarketFilters();
    renderMarketEnchants();
    renderMarketItems('');
    hideAutocomplete();
}

function closeItemMarket() {
    document.getElementById('item-market-overlay').classList.remove('active');
    marketCallback = null;
    marketSelectedItem = null;
    hideAutocomplete();
}

function renderMarketFilters() {
    var categories = [''];
    var seen = {};
    for (var i = 0; i < allItems.length; i++) {
        var c = allItems[i].category_name;
        if (c && !seen[c]) { seen[c] = true; categories.push(c); }
    }
    categories.sort();
    var catLabels = { '': 'All Items' };
    var icons = { 'Weapons': '⚔️', 'Resources': '🪵', 'Mounts': '🐴', 'Food': '🍖', 'Potions': '🧪', 'Capes': '🧣', 'Bags': '🎒', 'Shields': '🛡️', 'Off-hand': '📿', 'Fragments': '💎', 'Tomes': '📖' };
    var html = '';
    for (var i = 0; i < categories.length; i++) {
        var cat = categories[i];
        var label = (icons[cat] ? icons[cat] + ' ' : '') + (cat || 'All Items');
        var active = marketFilterCategory === cat ? ' active' : '';
        html += '<button class="market-filter-btn' + active + '" data-category="' + cat + '">' + label + '</button>';
    }
    document.getElementById('market-filters').innerHTML = html;
}

function renderMarketEnchants() {
    var html = '<span style="font-size:0.75em;color:var(--text-muted);margin-right:4px;align-self:center;">Enchant:</span>';
    html += '<button class="tier-btn active" data-enchant="">All</button>';
    for (var e = 0; e <= 4; e++) {
        html += '<button class="tier-btn" data-enchant="' + e + '">' + (e === 0 ? '0' : '.' + e) + '</button>';
    }
    document.getElementById('market-enchant-filters').innerHTML = html;
}

// Autocomplete dropdown
var autocompleteTimer = null;
var autocompleteIndex = -1;

function showAutocomplete(query) {
    var dropdown = document.getElementById('market-autocomplete');
    if (!query || query.length < 1) { hideAutocomplete(); return; }
    
    // Search locally for matches
    var q = query.toLowerCase();
    var matches = [];
    for (var i = 0; i < allItems.length; i++) {
        var item = allItems[i];
        var haystack = item.search || (item.id.toLowerCase() + ' ' + item.name.toLowerCase());
        if (haystack.indexOf(q) !== -1) {
            matches.push(item);
            if (matches.length >= 8) break;
        }
    }
    
    if (matches.length === 0) { hideAutocomplete(); return; }
    
    var html = '';
    for (var i = 0; i < matches.length; i++) {
        var item = matches[i];
        var tierClass = 'tier-t' + item.tier;
        var enchantBadge = item.enchant > 0 ? '<span class="enchant-badge">.' + item.enchant + '</span>' : '';
        html += '<div class="autocomplete-item' + (i === 0 ? ' selected' : '') + '" data-idx="' + i + '" data-id="' + item.id + '" onclick="pickAutocomplete(\'' + item.id.replace(/'/g, "\\'") + '\')">' +
            '<img class="autocomplete-icon" src="' + ICON_BASE + item.icon + '.png" onerror="this.style.display=\'none\'">' +
            '<span class="autocomplete-name">' + item.name + '</span>' +
            '<span class="autocomplete-tier ' + tierClass + '">T' + item.tier + '</span>' +
            enchantBadge +
            '<span class="autocomplete-id">' + item.id + '</span>' +
        '</div>';
    }
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
    autocompleteIndex = 0;
}

function hideAutocomplete() {
    var dropdown = document.getElementById('market-autocomplete');
    if (dropdown) { dropdown.style.display = 'none'; }
    autocompleteIndex = -1;
}

function pickAutocomplete(itemId) {
    var item = allItems.find(function(i) { return i.id === itemId; });
    if (!item) return;
    hideAutocomplete();
    selectMarketItem(itemId);
    document.getElementById('market-search-input').value = item.name;
}

function renderMarketItems(query) {
    var grid = document.getElementById('market-items-grid');
    var searchLower = query.toLowerCase();
    var filtered = allItems;
    
    if (marketFilterCategory) filtered = filtered.filter(function(i) { return i.category_name === marketFilterCategory; });
    if (marketFilterTier) filtered = filtered.filter(function(i) { return i.tier === parseInt(marketFilterTier); });
    if (marketFilterEnchant !== '') filtered = filtered.filter(function(i) { return i.enchant === parseInt(marketFilterEnchant); });
    
    if (searchLower) {
        filtered = filtered.filter(function(i) {
            var haystack = i.search || (i.id.toLowerCase() + ' ' + i.name.toLowerCase());
            return haystack.indexOf(searchLower) !== -1;
        });
    }
    
    var items = filtered.slice(0, 200);
    if (items.length === 0) {
        grid.innerHTML = '<div class="market-empty">No items found</div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var tierClass = 'tier-t' + item.tier;
        var enchantClass = item.enchant > 0 ? ' enchanted' : '';
        var enchantLabel = item.enchant > 0 ? '<span class="item-enchant-label">.' + item.enchant + '</span>' : '';
        html += '<div class="market-item' + enchantClass + '" data-id="' + item.id + '" onclick="selectMarketItem(\'' + item.id.replace(/'/g, "\\'") + '\')">' +
            '<div class="market-item-icon">' +
                '<img src="' + ICON_BASE + item.icon + '.png" alt="' + item.name + '" loading="lazy" ' +
                'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\';">' +
                '<span class="icon-fallback" style="display:none;">' + item.tier + '</span>' +
            '</div>' +
            '<span class="market-item-name">' + item.name + enchantLabel + '</span>' +
            '<span class="market-item-tier ' + tierClass + '">T' + item.tier + '</span>' +
        '</div>';
    }
    if (filtered.length > 200) {
        html += '<div class="market-empty">Showing 200 of ' + filtered.length + ' items. Refine your search.</div>';
    }
    grid.innerHTML = html;
    if (marketSelectedItem) {
        var el = grid.querySelector('[data-id="' + marketSelectedItem.id + '"]');
        if (el) el.classList.add('selected');
    }
    updateMarketSelectedInfo();
}

function selectMarketItem(itemId) {
    var item = allItems.find(function(i) { return i.id === itemId; });
    if (!item) return;
    marketSelectedItem = item;
    document.querySelectorAll('.market-item').forEach(function(el) { el.classList.remove('selected'); });
    var el = document.querySelector('.market-item[data-id="' + itemId + '"]');
    if (el) el.classList.add('selected');
    updateMarketSelectedInfo();
}

function updateMarketSelectedInfo() {
    var info = document.getElementById('market-selected-info');
    var btn = document.getElementById('market-select-btn');
    if (marketSelectedItem) {
        var enchant = marketSelectedItem.enchant > 0 ? ' <span class="enchant-badge">.' + marketSelectedItem.enchant + '</span>' : '';
        info.innerHTML = '<strong>' + marketSelectedItem.name + '</strong>' + enchant + ' <span style="color:var(--text-muted)">(' + marketSelectedItem.id + ')</span>';
        btn.disabled = false;
    } else {
        info.textContent = 'Click an item to select it';
        btn.disabled = true;
    }
}

function confirmMarketSelection() {
    if (!marketSelectedItem || !marketCallback) return;
    marketCallback(marketSelectedItem);
    closeItemMarket();
}

function setupMarketEvents() {
    // Overlay close
    document.getElementById('item-market-overlay').addEventListener('click', function(e) {
        if (e.target === document.getElementById('item-market-overlay')) closeItemMarket();
    });
    document.getElementById('market-close').addEventListener('click', closeItemMarket);
    
    // Search input with autocomplete
    var searchInput = document.getElementById('market-search-input');
    searchInput.addEventListener('input', function(e) {
        var val = e.target.value;
        clearTimeout(autocompleteTimer);
        autocompleteTimer = setTimeout(function() { showAutocomplete(val); }, 150);
        renderMarketItems(val);
    });
    searchInput.addEventListener('keydown', function(e) {
        var dropdown = document.getElementById('market-autocomplete');
        if (dropdown.style.display === 'none') return;
        var items = dropdown.querySelectorAll('.autocomplete-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (autocompleteIndex < items.length - 1) {
                if (autocompleteIndex >= 0) items[autocompleteIndex].classList.remove('selected');
                autocompleteIndex++;
                items[autocompleteIndex].classList.add('selected');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (autocompleteIndex > 0) {
                items[autocompleteIndex].classList.remove('selected');
                autocompleteIndex--;
                items[autocompleteIndex].classList.add('selected');
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (autocompleteIndex >= 0 && items[autocompleteIndex]) {
                var itemId = items[autocompleteIndex].dataset.id;
                pickAutocomplete(itemId);
            }
        } else if (e.key === 'Escape') {
            hideAutocomplete();
        }
    });
    searchInput.addEventListener('blur', function() {
        setTimeout(hideAutocomplete, 200);
    });
    
    // Category filters
    document.getElementById('market-filters').addEventListener('click', function(e) {
        if (e.target.classList.contains('market-filter-btn')) {
            marketFilterCategory = e.target.dataset.category;
            document.querySelectorAll('#market-filters .market-filter-btn').forEach(function(b) { b.classList.remove('active'); });
            e.target.classList.add('active');
            renderMarketItems(searchInput.value);
        }
    });
    
    // Tier filters
    document.getElementById('market-tier-filters').addEventListener('click', function(e) {
        if (e.target.classList.contains('tier-btn')) {
            marketFilterTier = e.target.dataset.tier;
            document.querySelectorAll('#market-tier-filters .tier-btn').forEach(function(b) { b.classList.remove('active'); });
            e.target.classList.add('active');
            renderMarketItems(searchInput.value);
        }
    });
    
    // Enchant filters
    document.getElementById('market-enchant-filters').addEventListener('click', function(e) {
        if (e.target.classList.contains('tier-btn')) {
            marketFilterEnchant = e.target.dataset.enchant;
            document.querySelectorAll('#market-enchant-filters .tier-btn').forEach(function(b) { b.classList.remove('active'); });
            e.target.classList.add('active');
            renderMarketItems(searchInput.value);
        }
    });
    
    // Clear / Select
    document.getElementById('market-clear-btn').addEventListener('click', function() {
        marketSelectedItem = null;
        document.querySelectorAll('.market-item').forEach(function(el) { el.classList.remove('selected'); });
        updateMarketSelectedInfo();
    });
    document.getElementById('market-select-btn').addEventListener('click', confirmMarketSelection);
    
    // History page search button
    document.getElementById('history-search-item-btn').addEventListener('click', function() {
        openItemMarket(function(item) {
            document.getElementById('history-item-input').value = item.id;
            var preview = document.getElementById('history-item-preview');
            preview.style.display = 'flex';
            var enchant = item.enchant > 0 ? ' <span class="enchant-badge">.' + item.enchant + '</span>' : '';
            preview.innerHTML = '<img src="' + ICON_BASE + item.icon + '.png" onerror="this.style.display=\'none\'"><span>' + item.name + enchant + ' (' + item.id + ')</span>';
        });
    });
    
    // Crafting page search button
    document.getElementById('craft-search-item-btn').addEventListener('click', function() {
        openItemMarket(function(item) {
            document.getElementById('craft-item-input').value = item.id;
            var preview = document.getElementById('craft-item-preview');
            preview.style.display = 'flex';
            var enchant = item.enchant > 0 ? ' <span class="enchant-badge">.' + item.enchant + '</span>' : '';
            preview.innerHTML = '<img src="' + ICON_BASE + item.icon + '.png" onerror="this.style.display=\'none\'"><span>' + item.name + enchant + ' (' + item.id + ')</span>';
        });
    });
}

async function loadItemsDB() {
    try {
        var resp = await fetch('/api/items-full');
        var data = await resp.json();
        allItems = data.items || [];
        console.log('Loaded ' + allItems.length + ' items');
    } catch (e) {
        console.error('Failed to load items DB:', e);
    }
}

// --- Start ---
init();
loadItemsDB();
setupMarketEvents();
