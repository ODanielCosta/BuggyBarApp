/**
 * Stock Management logic for Buggy Bar POS app.
 * Handles listing DEFAULT_CATALOG items with icons and categories,
 * daily stock adjustments, and an audit log with one-tap reversion.
 */

let isStockLogOpen = true;

function renderStockManagement() {
    const stockListContainer = document.getElementById('stock-list');
    const totalUnitsElement = document.getElementById('stock-total-units');
    if (!stockListContainer) return;

    const catalog = StorageManager.getCatalog();
    const stockMap = StorageManager.getStock();

    stockListContainer.innerHTML = '';
    let totalUnits = 0;

    catalog.forEach(item => {
        const currentStock = stockMap[item.id] || 0;
        totalUnits += currentStock;

        const card = document.createElement('div');
        card.className = 'bg-white p-3 rounded-xl border border-slate-200 shadow-2xs transition-shadow hover:shadow-xs';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-2">
                    <span class="text-2xl">${item.icon || '📦'}</span>
                    <div>
                        <div class="flex items-center gap-1.5">
                            <h3 class="font-bold text-slate-900 text-sm leading-snug">${item.name}</h3>
                            <span class="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded bg-slate-100 text-slate-500">
                                ${item.category || 'misc'}
                            </span>
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5">
                            Reg: <span class="font-semibold text-slate-700">€${item.regPrice.toFixed(2)}</span> · 
                            Mem: <span class="font-semibold text-blue-600">€${item.memPrice.toFixed(2)}</span>
                        </p>
                    </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-xs font-black ${
                    currentStock > 0 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                }">
                    ${currentStock} in stock
                </span>
            </div>

            <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <!-- Stepper Controls -->
                <div class="flex items-center gap-1.5">
                    <button 
                        type="button"
                        onclick="handleAdjustStock(${item.id}, -1)"
                        ${currentStock <= 0 ? 'disabled' : ''}
                        class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-black text-sm"
                        title="Decrease stock by 1"
                    >
                        -
                    </button>
                    
                    <button 
                        type="button"
                        onclick="promptSetStock(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${currentStock})"
                        class="w-11 h-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 font-black text-slate-900 text-sm"
                        title="Click to type exact stock"
                    >
                        ${currentStock}
                    </button>

                    <button 
                        type="button"
                        onclick="handleAdjustStock(${item.id}, 1)"
                        class="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-2xs"
                        title="Increase stock by 1"
                    >
                        +
                    </button>
                </div>

                <!-- Quick-Add Presets -->
                <div class="flex items-center gap-1">
                    <button 
                        type="button"
                        onclick="handleAdjustStock(${item.id}, 5)"
                        class="px-2 py-1 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-md border border-slate-200"
                    >
                        +5
                    </button>
                    <button 
                        type="button"
                        onclick="handleAdjustStock(${item.id}, 10)"
                        class="px-2 py-1 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-md border border-slate-200"
                    >
                        +10
                    </button>
                </div>
            </div>
        `;
        stockListContainer.appendChild(card);
    });

    if (totalUnitsElement) {
        totalUnitsElement.textContent = totalUnits;
    }

    renderStockActivityLog();
}

// Adjust stock by delta (+1, -1, +5, etc.)
window.handleAdjustStock = (itemId, amount) => {
    StorageManager.updateStock(itemId, amount, true);
    renderStockManagement();
    notifyStockUpdate();
};

// Prompt user to type direct number
window.promptSetStock = (itemId, itemName, currentVal) => {
    const input = prompt(`Enter exact stock quantity for ${itemName}:`, currentVal);
    if (input !== null) {
        const val = parseInt(input, 10);
        if (!isNaN(val) && val >= 0) {
            StorageManager.setStock(itemId, val, true);
            renderStockManagement();
            notifyStockUpdate();
        } else {
            alert("Please enter a valid non-negative number.");
        }
    }
};

// -------------------------------------------------------------
// Stock Activity Log & Reversion
// -------------------------------------------------------------
function renderStockActivityLog() {
    const logContainer = document.getElementById('stock-log-container');
    const badge = document.getElementById('stock-log-badge');
    if (!logContainer) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const log = StorageManager.getStockLog();
    const todayLogs = log.filter(e => e.date === todayStr);

    if (badge) {
        badge.textContent = todayLogs.length;
    }

    logContainer.innerHTML = '';

    if (todayLogs.length === 0) {
        logContainer.innerHTML = `
            <div class="py-4 text-center text-slate-400 text-xs">
                No stock adjustments recorded for today yet.
            </div>
        `;
        return;
    }

    todayLogs.forEach(entry => {
        const row = document.createElement('div');
        row.className = `p-2.5 rounded-lg border text-xs flex items-center justify-between ${
            entry.reverted ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-2xs'
        }`;

        let timeStr = 'Recently';
        if (entry.timestamp) {
            try {
                timeStr = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
        }

        const deltaPrefix = entry.delta > 0 ? `+${entry.delta}` : `${entry.delta}`;
        const deltaColor = entry.delta > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50';

        row.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-base">${entry.itemIcon || '📦'}</span>
                <div>
                    <div class="flex items-center gap-1.5 font-bold text-slate-900">
                        <span>${entry.itemName}</span>
                        <span class="font-extrabold px-1.5 py-0.2 rounded text-[10px] ${deltaColor}">
                            ${deltaPrefix} un
                        </span>
                        ${entry.reverted ? '<span class="text-[9px] bg-slate-200 text-slate-600 px-1 rounded font-bold">REVERTED</span>' : ''}
                    </div>
                    <div class="text-[10px] text-slate-400 mt-0.5">
                        ${timeStr} · Stock: ${entry.previousStock} → ${entry.newStock}
                    </div>
                </div>
            </div>

            <div>
                ${!entry.reverted && entry.delta !== 0 ? `
                    <button 
                        type="button" 
                        onclick="handleRevertStock(${entry.id})" 
                        class="text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[11px] font-bold px-2 py-1 rounded transition-colors"
                        title="Revert this stock adjustment"
                    >
                        Revert
                    </button>
                ` : ''}
            </div>
        `;

        logContainer.appendChild(row);
    });
}

window.handleRevertStock = (logId) => {
    const log = StorageManager.getStockLog();
    const entry = log.find(e => e.id === logId);
    if (!entry) return;

    const confirmMsg = `Revert adjustment for ${entry.itemName} (${entry.delta > 0 ? '+' : ''}${entry.delta})?`;
    if (confirm(confirmMsg)) {
        try {
            StorageManager.revertStockAdjustment(logId);
            renderStockManagement();
            notifyStockUpdate();
            if (window.showToast) {
                window.showToast(`↩️ Reverted ${entry.itemName} adjustment`);
            }
        } catch (err) {
            alert(err.message);
        }
    }
};

function setupStockLogToggle() {
    const toggleBtn = document.getElementById('btn-toggle-stock-log');
    const container = document.getElementById('stock-log-container');
    const arrow = document.getElementById('stock-log-arrow');

    if (toggleBtn && container) {
        toggleBtn.addEventListener('click', () => {
            isStockLogOpen = !isStockLogOpen;
            container.classList.toggle('hidden', !isStockLogOpen);
            if (arrow) arrow.textContent = isStockLogOpen ? '▼' : '▶';
        });
    }

    const resetBtn = document.getElementById('btn-reset-stock');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to reset all stock quantities to 0?")) {
                StorageManager.resetAllStock();
                renderStockManagement();
                notifyStockUpdate();
            }
        });
    }
}

// Notify other modules that stock has changed
function notifyStockUpdate() {
    window.dispatchEvent(new CustomEvent('bb_stock_updated'));
}

// Listen for updates from POS purchases or voided transactions
window.addEventListener('bb_stock_updated', () => {
    renderStockManagement();
});

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupStockLogToggle();
        renderStockManagement();
    });
} else {
    setupStockLogToggle();
    renderStockManagement();
}