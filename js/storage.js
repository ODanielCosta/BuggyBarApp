/**
 * StorageManager handles persistence for the Buggy Bar POS app
 * using browser localStorage.
 */

function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const STORAGE_KEYS = {
    CATALOG: 'bb_pos_catalog',
    STOCK: 'bb_pos_stock',
    INITIAL_STOCK: 'bb_pos_initial_stock',
    HISTORY: 'bb_pos_history',
    STOCK_LOG: 'bb_pos_stock_log',
    STOCK_DRAFT: 'bb_pos_stock_draft',
    VIEW_MODE: 'bb_pos_view_mode',
    ACTIVE_DATE: 'bb_pos_active_date',
    END_OF_RUN_ARCHIVE: 'bb_pos_end_of_run_archive'
};

const DEFAULT_CATALOG = [
    // Drinks
    { id: 1, name: "Água", icon: `<img src="img/Água.png" class="item-img" alt="Água">`, category: "drinks", regPrice: 2.00, memPrice: 1.50 },
    { id: 2, name: "Cerveja", icon: `<img src="img/Cerveja.jpg" class="item-img" alt="Cerveja">`, category: "drinks", regPrice: 5.00, memPrice: 4.50 },
    { id: 3, name: "Somersby", icon: `<img src="img/Somersby.png" class="item-img" alt="Somersby">`, category: "drinks", regPrice: 5.50, memPrice: 5.00 },
    { id: 4, name: "Coca Cola", icon: `<img src="img/Coca Cola.png" class="item-img" alt="Coca Cola">`, category: "drinks", regPrice: 4.50, memPrice: 4.00 },
    { id: 5, name: "Coca Cola 0", icon: `<img src="img/Coca Cola 0.png" class="item-img" alt="Coca Cola 0">`, category: "drinks", regPrice: 4.50, memPrice: 4.00 },
    { id: 6, name: "Fanta", icon: `<img src="img/Fanta.png" class="item-img" alt="Fanta">`, category: "drinks", regPrice: 4.50, memPrice: 4.00 },
    { id: 7, name: "Powerade", icon: `<img src="img/Powerade.png" class="item-img" alt="Powerade">`, category: "drinks", regPrice: 7.00, memPrice: 6.00 },
    { id: 8, name: "Café", icon: "☕", category: "drinks", regPrice: 2.00, memPrice: 1.50 },
    // Snacks
    { id: 9, name: "KIT KAT", icon: `<img src="img/Kit Kat.png" class="item-img" alt="KIT KAT">`, category: "snacks", regPrice: 2.50, memPrice: 2.00 },
    { id: 10, name: "SNICKERS", icon: `<img src="img/Snickers.png" class="item-img" alt="SNICKERS">`, category: "snacks", regPrice: 2.50, memPrice: 2.00 },
    { id: 11, name: "TWIX", icon: `<img src="img/Twix.png" class="item-img" alt="TWIX">`, category: "snacks", regPrice: 2.50, memPrice: 2.00 },
    { id: 12, name: "Pringles", icon: `<img src="img/Pringles.jpg" class="item-img" alt="Pringles">`, category: "snacks", regPrice: 4.50, memPrice: 4.00 },
    // Sandwiches (no images available — keep emoji)
    { id: 13, name: "Mista", icon: "🥪", category: "sandwiches", regPrice: 7.00, memPrice: 6.00, colabPrice: 2.00 },
    { id: 14, name: "Atum", icon: "🐟", category: "sandwiches", regPrice: 8.00, memPrice: 7.00, colabPrice: 2.00 },
    { id: 15, name: "Bacon & ovo", icon: "🥓", category: "sandwiches", regPrice: 8.00, memPrice: 7.00, colabPrice: 2.00 },
    { id: 16, name: "Frango", icon: "🍗", category: "sandwiches", regPrice: 8.00, memPrice: 7.00, colabPrice: 2.00 }
];

const StorageManager = {
    getLocalDateString: getLocalDateString,

    getCatalog: () => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.CATALOG);
            if (!data) {
                localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(DEFAULT_CATALOG));
                return DEFAULT_CATALOG;
            }
            let parsed = JSON.parse(data);
            if (!Array.isArray(parsed) || parsed.length === 0) {
                parsed = DEFAULT_CATALOG;
            }
            // Auto-merge missing icons, categories, and colabPrice from DEFAULT_CATALOG
            // CRITICAL: Only sandwiches can have colabPrice!
            parsed = parsed.map(item => {
                const defaultItem = DEFAULT_CATALOG.find(d => d.id === item.id);
                const category = item.category || (defaultItem ? defaultItem.category : "drinks");
                const isSandwich = category === 'sandwiches';

                const merged = {
                    ...defaultItem,
                    ...item,
                    // Always use the icon from DEFAULT_CATALOG so image tags are always fresh
                    icon: defaultItem ? defaultItem.icon : (item.icon || "🏷️"),
                    category: category
                };

                if (isSandwich) {
                    merged.colabPrice = (defaultItem && defaultItem.colabPrice !== undefined) 
                        ? defaultItem.colabPrice 
                        : (item.colabPrice !== undefined ? item.colabPrice : 2.00);
                } else {
                    delete merged.colabPrice; // Strictly remove for drinks, snacks, etc.
                }

                return merged;
            });
            localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(parsed));
            return parsed;
        } catch (e) {
            console.error("Error reading catalog from localStorage:", e);
            return DEFAULT_CATALOG;
        }
    },

    saveCatalog: (catalog) => {
        localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(catalog));
    },

    getStock: () => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.STOCK);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error("Error reading stock from localStorage:", e);
            return {};
        }
    },

    // Draft values are the quantities entered on the Stock tab but not yet
    // committed with "Lock Stock". They are intentionally kept separate from
    // live stock so they cannot be sold before they are locked.
    getStockDraft: () => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.STOCK_DRAFT);
            const draft = data ? JSON.parse(data) : {};
            return draft && typeof draft === 'object' ? draft : {};
        } catch (e) {
            console.error("Error reading stock draft:", e);
            return {};
        }
    },

    setStockDraft: (id, amount) => {
        const draft = StorageManager.getStockDraft();
        const value = parseInt(amount, 10) || 0;
        if (value === 0) {
            delete draft[id];
        } else {
            draft[id] = value;
        }
        localStorage.setItem(STORAGE_KEYS.STOCK_DRAFT, JSON.stringify(draft));
        return draft;
    },

    clearStockDraft: () => {
        localStorage.setItem(STORAGE_KEYS.STOCK_DRAFT, JSON.stringify({}));
    },

    // Commits all pending adjustments in one deliberate Stock-tab action.
    // A separate log record is retained for every item so its card can show
    // precisely when stock was added or removed.
    lockStockDraft: () => {
        const draft = StorageManager.getStockDraft();
        const stockMap = StorageManager.getStock();
        const catalog = StorageManager.getCatalog();
        const isFirstLock = Object.keys(StorageManager.getInitialStock()).length === 0;
        const timestamp = new Date().toISOString();
        const date = getLocalDateString();
        const batchId = `stock-lock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const entries = [];

        Object.entries(draft).forEach(([rawId, rawAmount]) => {
            const id = Number(rawId);
            const requestedDelta = parseInt(rawAmount, 10) || 0;
            if (!id || requestedDelta === 0) return;

            const previousStock = stockMap[id] || 0;
            const newStock = Math.max(0, previousStock + requestedDelta);
            const delta = newStock - previousStock;
            if (delta === 0) return;

            stockMap[id] = newStock;
            const item = catalog.find(candidate => candidate.id === id);
            entries.push({
                itemId: id,
                itemName: item ? item.name : `Item #${id}`,
                itemIcon: item ? item.icon : "📦",
                delta,
                previousStock,
                newStock,
                action: isFirstLock ? 'locked_initial' : (delta > 0 ? 'locked_add' : 'locked_remove'),
                batchId,
                timestamp,
                date
            });
        });

        if (entries.length) {
            localStorage.setItem(STORAGE_KEYS.STOCK, JSON.stringify(stockMap));
            entries.forEach(entry => StorageManager.addStockLogEntry(entry));

            // The reconciliation stock total includes every locked addition
            // and removal made during the run. Sales only change live stock,
            // so applying each locked delta here keeps the report's "Stock"
            // column in sync without affecting the "Left" quantity.
            if (isFirstLock) {
                localStorage.setItem(STORAGE_KEYS.INITIAL_STOCK, JSON.stringify(stockMap));
            } else {
                const initialMap = StorageManager.getInitialStock();
                entries.forEach(entry => {
                    const currentInitial = initialMap[entry.itemId] || 0;
                    initialMap[entry.itemId] = Math.max(0, currentInitial + entry.delta);
                });
                localStorage.setItem(STORAGE_KEYS.INITIAL_STOCK, JSON.stringify(initialMap));
            }
        }

        StorageManager.clearStockDraft();
        return entries;
    },

    getInitialStock: () => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.INITIAL_STOCK);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    },

    setInitialStock: (id, value) => {
        const initialMap = StorageManager.getInitialStock();
        initialMap[id] = Math.max(0, parseInt(value, 10) || 0);
        localStorage.setItem(STORAGE_KEYS.INITIAL_STOCK, JSON.stringify(initialMap));
        return initialMap;
    },

    snapshotCurrentStockAsInitial: () => {
        const currentStock = StorageManager.getStock();
        localStorage.setItem(STORAGE_KEYS.INITIAL_STOCK, JSON.stringify(currentStock));
        return currentStock;
    },

    clearInitialStock: () => {
        localStorage.setItem(STORAGE_KEYS.INITIAL_STOCK, JSON.stringify({}));
    },

    updateStock: (id, amount, log = true) => {
        const stockMap = StorageManager.getStock();
        const currentStock = stockMap[id] || 0;
        const newStock = Math.max(0, currentStock + amount);
        stockMap[id] = newStock;
        localStorage.setItem(STORAGE_KEYS.STOCK, JSON.stringify(stockMap));

        // If initial stock wasn't set for this item yet, initialize it
        const initialMap = StorageManager.getInitialStock();
        if (initialMap[id] === undefined && amount > 0) {
            initialMap[id] = newStock;
            localStorage.setItem(STORAGE_KEYS.INITIAL_STOCK, JSON.stringify(initialMap));
        }

        if (log && amount !== 0) {
            const catalog = StorageManager.getCatalog();
            const item = catalog.find(i => i.id === id);
            StorageManager.addStockLogEntry({
                itemId: id,
                itemName: item ? item.name : `Item #${id}`,
                itemIcon: item ? item.icon : "📦",
                delta: amount,
                previousStock: currentStock,
                newStock: newStock,
                action: amount > 0 ? "added" : "deducted"
            });
        }

        return newStock;
    },

    setStock: (id, value, log = true) => {
        const stockMap = StorageManager.getStock();
        const currentStock = stockMap[id] || 0;
        const newStock = Math.max(0, parseInt(value, 10) || 0);
        stockMap[id] = newStock;
        localStorage.setItem(STORAGE_KEYS.STOCK, JSON.stringify(stockMap));

        // If initial stock wasn't set for this item yet, initialize it
        const initialMap = StorageManager.getInitialStock();
        if (initialMap[id] === undefined) {
            initialMap[id] = newStock;
            localStorage.setItem(STORAGE_KEYS.INITIAL_STOCK, JSON.stringify(initialMap));
        }

        const delta = newStock - currentStock;
        if (log && delta !== 0) {
            const catalog = StorageManager.getCatalog();
            const item = catalog.find(i => i.id === id);
            StorageManager.addStockLogEntry({
                itemId: id,
                itemName: item ? item.name : `Item #${id}`,
                itemIcon: item ? item.icon : "📦",
                delta: delta,
                previousStock: currentStock,
                newStock: newStock,
                action: "adjusted"
            });
        }

        return newStock;
    },

    resetAllStock: () => {
        const catalog = StorageManager.getCatalog();
        const stockMap = {};
        catalog.forEach(item => {
            stockMap[item.id] = 0;
        });
        localStorage.setItem(STORAGE_KEYS.STOCK, JSON.stringify(stockMap));
        StorageManager.addStockLogEntry({
            itemId: 0,
            itemName: "All Items",
            itemIcon: "🔄",
            delta: 0,
            previousStock: 0,
            newStock: 0,
            action: "reset_all"
        });
        return stockMap;
    },

    // -------------------------------------------------------------
    // Stock Audit Log & Revertibility
    // -------------------------------------------------------------
    getStockLog: () => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.STOCK_LOG);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Error reading stock log:", e);
            return [];
        }
    },

    addStockLogEntry: (entry) => {
        const log = StorageManager.getStockLog();
        const newEntry = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            date: getLocalDateString(),
            timestamp: new Date().toISOString(),
            reverted: false,
            ...entry
        };
        log.unshift(newEntry);
        localStorage.setItem(STORAGE_KEYS.STOCK_LOG, JSON.stringify(log));
        return newEntry;
    },

    revertStockAdjustment: (logId) => {
        const log = StorageManager.getStockLog();
        const entry = log.find(e => e.id === logId);
        if (!entry || entry.reverted) {
            throw new Error("Log entry cannot be reverted.");
        }

        // To undo the change, apply the negative delta
        const reverseDelta = -entry.delta;
        if (entry.itemId > 0) {
            StorageManager.updateStock(entry.itemId, reverseDelta, false);
        }

        // Mark as reverted
        entry.reverted = true;
        entry.revertedAt = new Date().toISOString();

        // Add a reversal audit entry
        log.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            date: getLocalDateString(),
            timestamp: new Date().toISOString(),
            reverted: true,
            isReversal: true,
            itemId: entry.itemId,
            itemName: entry.itemName,
            itemIcon: entry.itemIcon,
            delta: reverseDelta,
            previousStock: entry.newStock,
            newStock: Math.max(0, entry.newStock + reverseDelta),
            action: "reverted"
        });

        localStorage.setItem(STORAGE_KEYS.STOCK_LOG, JSON.stringify(log));
        return true;
    },

    // -------------------------------------------------------------
    // History & Transaction Management
    // -------------------------------------------------------------
    getHistory: () => {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Error reading history from localStorage:", e);
            return [];
        }
    },

    saveTransaction: (transaction) => {
        const history = StorageManager.getHistory();
        const newTransaction = {
            ...transaction,
            id: Date.now(),
            date: transaction.date || getLocalDateString(),
            timestamp: new Date().toISOString(),
            tip: Number(transaction.tip) || 0
        };
        history.unshift(newTransaction);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
        return newTransaction;
    },

    deleteTransaction: (id) => {
        const history = StorageManager.getHistory();
        const filtered = history.filter(t => t.id !== id);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(filtered));
        return filtered;
    },

    clearTodayHistory: () => {
        const history = StorageManager.getHistory();
        const todayStr = getLocalDateString();
        const preserved = history.filter(t => {
            const date = t.date || (t.timestamp ? t.timestamp.split('T')[0] : '');
            return date !== todayStr;
        });
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(preserved));
        return preserved;
    },

    clearAllHistory: () => {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));
        return [];
    },

    // -------------------------------------------------------------
    // End of Run Reconciliation & Daily Reset
    // -------------------------------------------------------------
    getEndOfRunData: (targetDate) => {
        const dateStr = targetDate || getLocalDateString();
        const catalog = StorageManager.getCatalog();
        const currentStock = StorageManager.getStock();
        const initialStock = StorageManager.getInitialStock();
        const history = StorageManager.getHistory();

        // Filter transactions for target date
        const dayTransactions = history.filter(t => {
            const d = t.date || (t.timestamp ? t.timestamp.split('T')[0] : '');
            return d === dateStr;
        });

        const salesPerItem = {};
        let totalSalesRevenue = 0;
        let totalTips = 0;
        let totalSoldUnits = 0;
        let totalCashCollected = 0;

        dayTransactions.forEach(t => {
            const itemsRev = typeof t.itemsSubtotal === 'number' 
                ? t.itemsSubtotal 
                : Math.max(0, (t.total || 0) - (t.tip || 0));
            totalSalesRevenue += itemsRev;
            totalTips += (t.tip || 0);
            totalCashCollected += (t.cashReceived || t.total || 0);

            if (Array.isArray(t.items)) {
                t.items.forEach(item => {
                    const itemId = item.itemId;
                    if (!salesPerItem[itemId]) {
                        salesPerItem[itemId] = {
                            soldTotal: 0,
                            soldReg: 0,
                            soldMem: 0,
                            soldColab: 0,
                            revenue: 0
                        };
                    }
                    const qty = item.qty || 0;
                    const subtotal = item.subtotal || (item.unitPrice ? item.unitPrice * qty : 0);
                    salesPerItem[itemId].soldTotal += qty;
                    salesPerItem[itemId].revenue += subtotal;
                    totalSoldUnits += qty;

                    if (item.priceType === 'mem') {
                        salesPerItem[itemId].soldMem += qty;
                    } else if (item.priceType === 'colab') {
                        salesPerItem[itemId].soldColab += qty;
                    } else {
                        salesPerItem[itemId].soldReg += qty;
                    }
                });
            }
        });

        const itemsReport = catalog.map(item => {
            const initial = initialStock[item.id] !== undefined ? initialStock[item.id] : 0;
            const current = currentStock[item.id] !== undefined ? currentStock[item.id] : 0;
            const sales = salesPerItem[item.id] || { soldTotal: 0, soldReg: 0, soldMem: 0, soldColab: 0, revenue: 0 };
            const expectedLeft = Math.max(0, initial - sales.soldTotal);
            const variance = current - expectedLeft;

            return {
                id: item.id,
                name: item.name,
                icon: item.icon,
                category: item.category,
                regPrice: item.regPrice,
                memPrice: item.memPrice,
                colabPrice: item.colabPrice,
                initialStock: initial,
                currentStock: current,
                soldTotal: sales.soldTotal,
                soldReg: sales.soldReg,
                soldMem: sales.soldMem,
                soldColab: sales.soldColab,
                revenue: sales.revenue,
                expectedLeft: expectedLeft,
                variance: variance
            };
        });

        return {
            date: dateStr,
            items: itemsReport,
            totalSoldUnits: totalSoldUnits,
            totalSalesRevenue: totalSalesRevenue,
            totalTips: totalTips,
            totalCashCollected: totalCashCollected,
            totalOrders: dayTransactions.length
        };
    },

    checkAndHandleDailyReset: () => {
        const storedDate = localStorage.getItem(STORAGE_KEYS.ACTIVE_DATE);
        const todayStr = getLocalDateString();

        if (!storedDate) {
            localStorage.setItem(STORAGE_KEYS.ACTIVE_DATE, todayStr);
            return { reset: false, date: todayStr };
        }

        if (storedDate !== todayStr) {
            // A new day has passed!
            // 1. Archive previous day's end-of-run data
            try {
                const prevReport = StorageManager.getEndOfRunData(storedDate);
                const archive = JSON.parse(localStorage.getItem(STORAGE_KEYS.END_OF_RUN_ARCHIVE) || '{}');
                archive[storedDate] = prevReport;
                localStorage.setItem(STORAGE_KEYS.END_OF_RUN_ARCHIVE, JSON.stringify(archive));
            } catch (e) {
                console.error("Error archiving end of run:", e);
            }

            // 2. Reset daily stock to 0
            StorageManager.resetAllStock();

            // 3. Clear daily initial stock
            StorageManager.clearInitialStock();

            // 4. Clear daily stock log
            localStorage.removeItem(STORAGE_KEYS.STOCK_LOG);
            StorageManager.clearStockDraft();

            // 5. Update active date
            localStorage.setItem(STORAGE_KEYS.ACTIVE_DATE, todayStr);

            // IMPORTANT: History is preserved!

            // 6. Dispatch event
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('bb_day_reset', {
                    detail: { previousDate: storedDate, newDate: todayStr }
                }));
            }

            return { reset: true, previousDate: storedDate, currentDate: todayStr };
        }

        return { reset: false, date: todayStr };
    },

    closeRunAndReset: () => {
        const todayStr = getLocalDateString();
        try {
            const report = StorageManager.getEndOfRunData(todayStr);
            const archive = JSON.parse(localStorage.getItem(STORAGE_KEYS.END_OF_RUN_ARCHIVE) || '{}');
            archive[todayStr] = report;
            localStorage.setItem(STORAGE_KEYS.END_OF_RUN_ARCHIVE, JSON.stringify(archive));
        } catch (e) {}

        StorageManager.resetAllStock();
        StorageManager.clearInitialStock();
        localStorage.removeItem(STORAGE_KEYS.STOCK_LOG);
        StorageManager.clearStockDraft();

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bb_stock_updated'));
            window.dispatchEvent(new CustomEvent('bb_day_reset', {
                detail: { manual: true, date: todayStr }
            }));
        }
    },

    // -------------------------------------------------------------
    // Backup & Restore
    // -------------------------------------------------------------
    exportAllData: () => {
        return {
            app: "Buggy Bar POS",
            version: "1.1",
            exportDate: new Date().toISOString(),
            catalog: StorageManager.getCatalog(),
            stock: StorageManager.getStock(),
            initialStock: StorageManager.getInitialStock(),
            history: StorageManager.getHistory(),
            stockLog: StorageManager.getStockLog()
        };
    },

    importAllData: (data) => {
        if (!data || typeof data !== 'object') {
            throw new Error("Invalid backup data format.");
        }
        if (data.catalog && Array.isArray(data.catalog)) {
            localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(data.catalog));
        }
        if (data.stock && typeof data.stock === 'object') {
            localStorage.setItem(STORAGE_KEYS.STOCK, JSON.stringify(data.stock));
        }
        if (data.initialStock && typeof data.initialStock === 'object') {
            localStorage.setItem(STORAGE_KEYS.INITIAL_STOCK, JSON.stringify(data.initialStock));
        }
        if (data.history && Array.isArray(data.history)) {
            localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(data.history));
        }
        if (data.stockLog && Array.isArray(data.stockLog)) {
            localStorage.setItem(STORAGE_KEYS.STOCK_LOG, JSON.stringify(data.stockLog));
        }
    }
};

if (typeof window !== 'undefined') {
    window.StorageManager = StorageManager;
    window.STORAGE_KEYS = STORAGE_KEYS;
    window.DEFAULT_CATALOG = DEFAULT_CATALOG;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
