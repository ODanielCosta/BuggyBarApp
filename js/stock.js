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
    const draftMap = StorageManager.getStockDraft();
    const stockLog = StorageManager.getStockLog();

    stockListContainer.innerHTML = '';
    let totalUnits = 0;

    catalog.forEach(item => {
        const currentStock = stockMap[item.id] || 0;
        const draftChange = parseInt(draftMap[item.id], 10) || 0;
        const movements = stockLog.filter(entry =>
            entry.itemId === item.id &&
            ['locked_initial', 'locked_add', 'locked_remove'].includes(entry.action)
        );
        const movementMarkup = movements.length ? `
            <div class="mt-2 pt-2 border-t border-slate-100 space-y-1">
                <p class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Locked stock history</p>
                ${movements.map(entry => {
                    const time = entry.timestamp
                        ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Recently';
                    const isInitial = entry.action === 'locked_initial';
                    const isAddition = entry.delta > 0;
                    const label = isInitial ? 'Stock locked' : (isAddition ? 'Stock added' : 'Stock removed');
                    const amount = `${entry.delta > 0 ? '+' : ''}${entry.delta}`;
                    return `
                        <div class="flex items-center justify-between gap-2 text-[11px] ${entry.reverted ? 'opacity-45 line-through' : ''}">
                            <span class="text-slate-600">${label} <span class="font-bold ${isAddition ? 'text-emerald-700' : 'text-amber-700'}">${amount}</span>${entry.reverted ? ' (reverted)' : ''}</span>
                            <span class="shrink-0 text-slate-400">${time}</span>
                        </div>`;
                }).join('')}
            </div>` : `
            <p class="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">No locked stock recorded yet.</p>`;
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
                            ${(item.category === 'sandwiches' && item.colabPrice !== undefined) ? ` · Colab: <span class="font-semibold text-purple-600">€${item.colabPrice.toFixed(2)}</span>` : ''}
                        </p>
                    </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-xs font-black ${
                    currentStock > 0 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                }">
                    ${currentStock} locked
                </span>
            </div>

            ${movementMarkup}

            <div class="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-slate-100">
                <!-- Pending adjustment controls. These do not change live stock until locked. -->
                <div class="flex items-center gap-1.5">
                    <span class="text-[10px] font-bold uppercase tracking-wide text-amber-700">Change</span>
                    <button 
                        type="button"
                        onclick="handlePendingStockAdjustment(${item.id}, -1)"
                        class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm"
                        title="Remove 1 when stock is locked"
                    >
                        -
                    </button>
                    
                    <input
                        type="number"
                        inputmode="numeric"
                        value="${draftChange}"
                        onchange="handlePendingStockInput(${item.id}, this.value)"
                        class="w-14 h-8 text-center rounded-lg bg-amber-50 border border-amber-200 font-black text-slate-900 text-sm"
                        title="Pending change: positive adds stock, negative removes stock"
                        aria-label="Pending stock change for ${item.name}"
                    />

                    <button 
                        type="button"
                        onclick="handlePendingStockAdjustment(${item.id}, 1)"
                        class="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-2xs"
                        title="Add 1 when stock is locked"
                    >
                        +
                    </button>
                </div>

                <!-- Quick-Add Presets -->
                <div class="flex items-center gap-1">
                    <button 
                        type="button"
                        onclick="handlePendingStockAdjustment(${item.id}, 5)"
                        class="px-2 py-1 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-md border border-slate-200"
                    >
                        +5
                    </button>
                    <button 
                        type="button"
                        onclick="handlePendingStockAdjustment(${item.id}, 10)"
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

// Pending values are deliberately separate from the live inventory. Pressing
// Lock Stock commits all of them together and clears every input back to zero.
window.handlePendingStockInput = (itemId, value) => {
    StorageManager.setStockDraft(itemId, value);
};

window.handlePendingStockAdjustment = (itemId, amount) => {
    const draft = StorageManager.getStockDraft();
    const nextValue = (parseInt(draft[itemId], 10) || 0) + amount;
    StorageManager.setStockDraft(itemId, nextValue);
    renderStockManagement();
};

// Kept as a compatibility alias for any older inline controls.
window.handleAdjustStock = window.handlePendingStockAdjustment;

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

    // --- Merge consecutive same-item same-minute entries ---
    function getMinuteKey(entry) {
        try {
            const d = new Date(entry.timestamp);
            return `${entry.itemId}_${d.getFullYear()}-${d.getMonth()}-${d.getDate()}_${d.getHours()}-${d.getMinutes()}`;
        } catch (e) {
            return `${entry.itemId}_unknown`;
        }
    }

    const mergedLogs = [];
    todayLogs.forEach(entry => {
        if (entry.reverted || entry.isReversal) {
            // Always show revert/reversal entries separately
            mergedLogs.push({ ...entry, _merged: false });
            return;
        }
        const key = getMinuteKey(entry);
        const last = mergedLogs[mergedLogs.length - 1];
        if (last && !last.reverted && !last.isReversal && last._mergeKey === key && last.delta !== 0 && entry.delta !== 0 && Math.sign(last.delta) === Math.sign(entry.delta)) {
            // Merge into last
            last.delta += entry.delta;
            last.newStock = entry.newStock;
            last._merged = true;
        } else {
            mergedLogs.push({ ...entry, _mergeKey: key, _merged: false });
        }
    });

    mergedLogs.forEach(entry => {
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
        const mergedLabel = entry._merged ? ' <span class="text-[9px] text-slate-400 ml-0.5">(merged)</span>' : '';

        row.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-base">${entry.itemIcon || '📦'}</span>
                <div>
                    <div class="flex items-center gap-1.5 font-bold text-slate-900">
                        <span>${entry.itemName}</span>
                        <span class="font-extrabold px-1.5 py-0.2 rounded text-[10px] ${deltaColor}">
                            ${deltaPrefix} un${mergedLabel}
                        </span>
                        ${entry.reverted ? '<span class="text-[9px] bg-slate-200 text-slate-600 px-1 rounded font-bold">REVERTED</span>' : ''}
                    </div>
                    <div class="text-[10px] text-slate-400 mt-0.5">
                        ${timeStr} · Stock: ${entry.previousStock} → ${entry.newStock}
                    </div>
                </div>
            </div>

            <div>
                ${!entry.reverted && entry.delta !== 0 && !entry._merged ? `
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

// -------------------------------------------------------------
// End of Run Reconciliation Report
// -------------------------------------------------------------
let endOfRunSummaryText = '';

function setupEndOfRunReport() {
    const btnOpenStock = document.getElementById('btn-open-end-of-run');
    const btnOpenHistory = document.getElementById('btn-history-end-of-run');
    const btnClose = document.getElementById('btn-close-end-of-run-modal');
    const btnCopy = document.getElementById('btn-copy-end-of-run');
    const btnCloseShift = document.getElementById('btn-close-shift-reset');
    const btnSetInitial = document.getElementById('btn-set-initial-stock');
    const modal = document.getElementById('modal-end-of-run');

    const openModal = () => {
        renderEndOfRunModal();
        if (modal) modal.classList.remove('hidden');
    };

    const closeModal = () => {
        if (modal) modal.classList.add('hidden');
    };

    if (btnOpenStock) btnOpenStock.addEventListener('click', openModal);
    if (btnOpenHistory) btnOpenHistory.addEventListener('click', openModal);
    if (btnClose) btnClose.addEventListener('click', closeModal);

    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            if (!endOfRunSummaryText) return;
            navigator.clipboard.writeText(endOfRunSummaryText).then(() => {
                if (window.showToast) window.showToast("📋 Report copied to clipboard!");
            }).catch(err => {
                alert("Failed to copy report: " + err);
            });
        });
    }

    if (btnCloseShift) {
        btnCloseShift.addEventListener('click', () => {
            if (confirm("⚠️ Finalize this run?\n\nThis will archive today's reconciliation report, reset daily stock to 0 for tomorrow, and clear the active register. All sales history will be safely preserved.")) {
                StorageManager.closeRunAndReset();
                closeModal();
                if (window.showToast) {
                    window.showToast("🌅 Run closed! Stock reset for tomorrow.");
                }
            }
        });
    }

    if (btnSetInitial) {
        btnSetInitial.addEventListener('click', () => {
            const draft = StorageManager.getStockDraft();
            const adjustments = Object.entries(draft).filter(([, amount]) => (parseInt(amount, 10) || 0) !== 0);
            if (!adjustments.length) {
                if (window.showToast) window.showToast('Enter an addition or removal before locking stock.');
                return;
            }

            const msg = `Lock ${adjustments.length} stock adjustment${adjustments.length === 1 ? '' : 's'}?\n\nThis updates live stock, records the time on each item, and resets all pending inputs to 0.`;
            if (confirm(msg)) {
                const entries = StorageManager.lockStockDraft();
                renderStockManagement();
                notifyStockUpdate();
                if (window.showToast) {
                    window.showToast(`Stock locked: ${entries.length} item${entries.length === 1 ? '' : 's'} updated.`);
                }
            }
        });
    }
}

function renderEndOfRunModal() {
    const data = StorageManager.getEndOfRunData();
    const tableBody = document.getElementById('end-of-run-table-body');
    const dateDisplay = document.getElementById('end-of-run-date');
    const kpiSold = document.getElementById('eor-kpi-sold');
    const kpiRev = document.getElementById('eor-kpi-revenue');
    const kpiTips = document.getElementById('eor-kpi-tips');
    const kpiOrders = document.getElementById('eor-kpi-orders');

    if (dateDisplay) dateDisplay.textContent = `Date: ${data.date} (${new Date().toLocaleDateString(undefined, { weekday: 'long' })})`;
    if (kpiSold) kpiSold.textContent = `${data.totalSoldUnits} un`;
    if (kpiRev) kpiRev.textContent = `€${data.totalSalesRevenue.toFixed(2)}`;
    if (kpiTips) kpiTips.textContent = `€${data.totalTips.toFixed(2)}`;
    if (kpiOrders) kpiOrders.textContent = `${data.totalOrders}`;

    if (!tableBody) return;
    tableBody.innerHTML = '';

    let textReport = `📊 BUGGY BAR - END OF RUN REPORT\n`;
    textReport += `Date: ${data.date}\n`;
    textReport += `----------------------------------------\n`;
    textReport += `Revenue (Sales): €${data.totalSalesRevenue.toFixed(2)}\n`;
    textReport += `Tips Received:   €${data.totalTips.toFixed(2)}\n`;
    textReport += `Total Cash:      €${data.totalCashCollected.toFixed(2)}\n`;
    textReport += `Total Units:     ${data.totalSoldUnits} sold across ${data.totalOrders} orders\n`;
    textReport += `----------------------------------------\n`;
    textReport += `ITEM RECONCILIATION:\n`;

    data.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100 hover:bg-slate-50 text-xs';
        tr.innerHTML = `
            <td class="py-2 px-2">
                <div class="flex items-center gap-1.5 font-bold text-slate-900">
                    <span class="report-item-icon flex h-9 w-9 shrink-0 items-center justify-center text-[2.25rem] leading-none">${item.icon || '📦'}</span>
                    <span>${item.name}</span>
                </div>
            </td>
            <td class="py-2 px-2 text-center font-bold text-slate-700">${item.initialStock}</td>
            <td class="py-2 px-2 text-center font-bold text-slate-700">${item.currentStock}</td>
            <td class="py-2 px-2 text-center font-bold ${item.soldReg > 0 ? 'text-emerald-600' : 'text-slate-300'}">${item.soldReg}</td>
            <td class="py-2 px-2 text-center font-bold ${item.soldMem > 0 ? 'text-blue-600' : 'text-slate-300'}">${item.soldMem}</td>
            <td class="py-2 px-2 text-center font-bold ${item.soldColab > 0 ? 'text-purple-600' : 'text-slate-300'}">${item.soldColab}</td>
            <td class="py-2 px-2 text-right font-black text-slate-800">€${item.revenue.toFixed(2)}</td>
        `;
        tableBody.appendChild(tr);

        if (item.initialStock > 0 || item.soldTotal > 0 || item.currentStock > 0) {
            textReport += `• ${item.name}: Stock: ${item.initialStock} | Left: ${item.currentStock} | Reg: ${item.soldReg} | Mem: ${item.soldMem} | Colab: ${item.soldColab} => €${item.revenue.toFixed(2)}\n`;
        }
    });

    textReport += `----------------------------------------\n`;
    textReport += `Buggy Bar POS`;

    endOfRunSummaryText = textReport;
}

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
                StorageManager.clearStockDraft();
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

window.addEventListener('bb_day_reset', () => {
    renderStockManagement();
});

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupStockLogToggle();
        setupEndOfRunReport();
        renderStockManagement();
    });
} else {
    setupStockLogToggle();
    setupEndOfRunReport();
    renderStockManagement();
}
