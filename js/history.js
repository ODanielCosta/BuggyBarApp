/**
 * History and Reporting logic for Buggy Bar POS.
 * Handles date-grouped transaction logs, daily metrics with tip tracking,
 * voiding orders with stock restoration, clearing all history,
 * and JSON export/import.
 */

function initHistory() {
    renderHistory();
    setupExportImportListeners();
    setupClearListeners();
    updateHeaderDate();

    window.addEventListener('bb_history_updated', () => {
        renderHistory();
    });

    window.addEventListener('bb_day_reset', () => {
        updateHeaderDate();
        renderHistory();
    });
}

function updateHeaderDate() {
    const badge = document.getElementById('current-date-badge');
    if (badge) {
        const today = new Date();
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        badge.textContent = today.toLocaleDateString(undefined, options);
    }
}

function renderHistory() {
    const historyListContainer = document.getElementById('history-list');
    if (!historyListContainer) return;

    const history = StorageManager.getHistory();
    historyListContainer.innerHTML = '';

    renderDailySummary(history);

    if (history.length === 0) {
        historyListContainer.innerHTML = `
            <div class="bg-white rounded-xl p-8 border border-slate-200 text-center text-slate-400 text-sm">
                <span class="text-3xl block mb-2">📜</span>
                No transactions recorded yet.<br>Completed orders will appear here.
            </div>
        `;
        return;
    }

    // Group transactions by Date (YYYY-MM-DD)
    const grouped = {};
    history.forEach(entry => {
        const dateKey = entry.date || (entry.timestamp ? entry.timestamp.split('T')[0] : 'Unknown');
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(entry);
    });

    const todayStr = StorageManager.getLocalDateString();

    Object.keys(grouped).sort().reverse().forEach(dateStr => {
        const dateSection = document.createElement('div');
        dateSection.className = 'mb-4';

        let dateLabel = dateStr;
        if (dateStr === todayStr) {
            dateLabel = `Today (${dateStr})`;
        } else {
            try {
                const [y, m, d] = dateStr.split('-');
                const dObj = new Date(y, m - 1, d);
                dateLabel = dObj.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
            } catch (e) {
                dateLabel = dateStr;
            }
        }

        // Calculate day's items revenue and tips
        let dayItemsRev = 0;
        let dayTips = 0;
        grouped[dateStr].forEach(e => {
            dayItemsRev += typeof e.itemsSubtotal === 'number' 
                ? e.itemsSubtotal 
                : Math.max(0, (e.total || 0) - (e.tip || 0));
            dayTips += (e.tip || 0);
        });

        const dateHeader = document.createElement('div');
        dateHeader.className = 'flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1';
        dateHeader.innerHTML = `
            <span>${dateLabel}</span>
            <span class="text-[11px] font-semibold text-slate-500">
                Rev: <b class="text-emerald-700">€${dayItemsRev.toFixed(2)}</b>${dayTips > 0 ? ` · Tip: <b class="text-amber-700">€${dayTips.toFixed(2)}</b>` : ''} · ${grouped[dateStr].length} ord
            </span>
        `;
        dateSection.appendChild(dateHeader);

        const ordersContainer = document.createElement('div');
        ordersContainer.className = 'space-y-2';

        grouped[dateStr].forEach(entry => {
            const orderCard = document.createElement('div');
            orderCard.className = 'bg-white p-3 rounded-xl border border-slate-200 shadow-2xs text-xs';

            let timeStr = 'Recently';
            if (entry.timestamp) {
                try {
                    timeStr = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch (e) {}
            }

            const itemsListHtml = entry.items.map(item => {
                let pLabel = 'Reg';
                let pClass = 'text-slate-400';
                if (item.priceType === 'mem') {
                    pLabel = 'Mem';
                    pClass = 'text-blue-600 font-semibold';
                } else if (item.priceType === 'colab') {
                    pLabel = 'Colab';
                    pClass = 'text-purple-600 font-bold';
                }
                return `
                <div class="flex justify-between items-center gap-2 py-0.5 text-slate-700">
                    <div class="flex min-w-0 items-center gap-1.5">
                        <span class="history-item-icon flex h-9 w-9 shrink-0 items-center justify-center text-[2.25rem] leading-none">${item.icon || '🏷️'}</span>
                        <span class="min-w-0">
                            <b class="text-slate-900">${item.qty}x</b> ${item.name}
                            <span class="text-[9px] ${pClass}">(${pLabel})</span>
                        </span>
                    </div>
                    <span class="shrink-0 font-semibold">€${(item.subtotal || (item.unitPrice ? item.unitPrice * item.qty : 0)).toFixed(2)}</span>
                </div>
            `}).join('');

            const tipHtml = entry.tip > 0 ? `
                <div class="flex justify-between items-center text-amber-700 text-[11px] font-bold border-t border-slate-100 pt-1 mt-1">
                    <span>🪙 Tip:</span>
                    <span>+€${entry.tip.toFixed(2)}</span>
                </div>
            ` : '';

            orderCard.innerHTML = `
                <div class="flex justify-between items-center mb-1.5 pb-1 border-b border-slate-100">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-slate-900 text-xs">#${entry.id.toString().slice(-4)}</span>
                        <span class="text-[10px] text-slate-400 font-medium">${timeStr}</span>
                    </div>
                    <button 
                        onclick="handleVoidTransaction(${entry.id})" 
                        class="text-rose-500 hover:text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-rose-50 transition-colors"
                        title="Void order and return stock"
                    >
                        Void
                    </button>
                </div>

                <div class="space-y-0.5 mb-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    ${itemsListHtml}
                    ${tipHtml}
                </div>

                <div class="flex justify-between items-center pt-1 border-t border-slate-100">
                    <div>
                        <span class="text-[10px] text-slate-500">Cash: €${(entry.cashReceived || 0).toFixed(2)}</span>
                        <span class="text-[10px] text-slate-400 ml-1">· Chg: €${(entry.changeGiven || 0).toFixed(2)}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-[9px] text-slate-400 uppercase mr-1">Total Paid</span>
                        <span class="text-sm font-black text-slate-900">€${(entry.total || 0).toFixed(2)}</span>
                    </div>
                </div>
            `;
            ordersContainer.appendChild(orderCard);
        });

        dateSection.appendChild(ordersContainer);
        historyListContainer.appendChild(dateSection);
    });
}

function renderDailySummary(history) {
    const summaryRev = document.getElementById('summary-revenue');
    const summaryTips = document.getElementById('summary-tips');
    const summaryOrders = document.getElementById('summary-orders');
    const summaryItems = document.getElementById('summary-items');

    if (!summaryRev || !summaryOrders || !summaryItems) return;

    const todayStr = StorageManager.getLocalDateString();

    let todayRevenue = 0;
    let todayTips = 0;
    let todayOrdersCount = 0;
    let todayUnitsCount = 0;

    history.forEach(entry => {
        const entryDate = entry.date || (entry.timestamp ? entry.timestamp.split('T')[0] : '');
        if (entryDate === todayStr) {
            // CRITICAL: Revenue is ONLY items sold, NOT tips!
            const itemsRev = typeof entry.itemsSubtotal === 'number' 
                ? entry.itemsSubtotal 
                : Math.max(0, (entry.total || 0) - (entry.tip || 0));
            todayRevenue += itemsRev;
            todayTips += (entry.tip || 0);
            todayOrdersCount += 1;
            if (Array.isArray(entry.items)) {
                entry.items.forEach(i => {
                    todayUnitsCount += i.qty || 0;
                });
            }
        }
    });

    summaryRev.textContent = `€${todayRevenue.toFixed(2)}`;
    if (summaryTips) summaryTips.textContent = `€${todayTips.toFixed(2)}`;
    summaryOrders.textContent = todayOrdersCount;
    summaryItems.textContent = todayUnitsCount;
}

window.handleVoidTransaction = (id) => {
    const history = StorageManager.getHistory();
    const entry = history.find(t => t.id === id);

    if (!entry) return;

    if (confirm(`Void order #${id.toString().slice(-4)}? This will restore its items back into Stock.`)) {
        if (Array.isArray(entry.items)) {
            entry.items.forEach(item => {
                if (item.itemId) {
                    StorageManager.updateStock(item.itemId, item.qty, false);
                }
            });
        }

        StorageManager.deleteTransaction(id);
        renderHistory();
        window.dispatchEvent(new CustomEvent('bb_stock_updated'));

        if (window.showToast) {
            window.showToast(`Order #${id.toString().slice(-4)} voided.`);
        }
    }
};

function setupClearListeners() {
    const clearAllBtn = document.getElementById('btn-clear-all-history');

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            const history = StorageManager.getHistory();
            if (history.length === 0) {
                alert("There is no transaction history to clear.");
                return;
            }

            if (confirm(`⚠️ DANGER: Are you sure you want to permanently clear ALL ${history.length} transaction(s) across all dates?\n\nThis will completely erase history.`)) {
                StorageManager.clearAllHistory();
                renderHistory();
                window.dispatchEvent(new CustomEvent('bb_history_updated'));
                if (window.showToast) {
                    window.showToast("🗑️ All sales history cleared.");
                }
            }
        });
    }
}

function setupExportImportListeners() {
    const exportBtn = document.getElementById('btn-export-data');
    const importBtn = document.getElementById('btn-import-data');
    const fileInput = document.getElementById('backup-import-file');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const data = StorageManager.exportAllData();
            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `buggy_bar_backup_${dateStr}.json`;

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (window.showToast) {
                window.showToast(`📥 Backup saved: ${filename}`);
            }
        });
    }

    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    if (parsed && (parsed.history || parsed.stock || parsed.catalog)) {
                        StorageManager.importAllData(parsed);
                        alert("Backup data restored successfully!");
                        renderHistory();
                        window.dispatchEvent(new CustomEvent('bb_stock_updated'));
                    } else {
                        alert("Invalid file: does not contain Buggy Bar POS data.");
                    }
                } catch (err) {
                    alert("Error parsing JSON file: " + err.message);
                }
            };
            reader.readAsText(file);
            fileInput.value = '';
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHistory);
} else {
    initHistory();
}
