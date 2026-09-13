/**
 * StorageManager handles persistence for the Buggy Bar POS app
 * using browser localStorage.
 */

const STORAGE_KEYS = {
    CATALOG: 'bb_pos_catalog',
    STOCK: 'bb_pos_stock',
    HISTORY: 'bb_pos_history',
    STOCK_LOG: 'bb_pos_stock_log',
    VIEW_MODE: 'bb_pos_view_mode'
};

const DEFAULT_CATALOG = [
    // Drinks
    { id: 1, name: "Água", icon: "💧", category: "drinks", regPrice: 2.00, memPrice: 1.50 },
    { id: 2, name: "Cerveja", icon: "🍺", category: "drinks", regPrice: 5.00, memPrice: 4.50 },
    { id: 3, name: "Somersby", icon: "🍏", category: "drinks", regPrice: 5.50, memPrice: 5.00 },
    { id: 4, name: "Coca Cola", icon: "🥤", category: "drinks", regPrice: 4.50, memPrice: 4.00 },
    { id: 5, name: "Coca Cola 0", icon: "🥤", category: "drinks", regPrice: 4.50, memPrice: 4.00 },
    { id: 6, name: "Fanta", icon: "🍊", category: "drinks", regPrice: 4.50, memPrice: 4.00 },
    { id: 7, name: "Powerade", icon: "⚡", category: "drinks", regPrice: 7.00, memPrice: 6.00 },
    { id: 8, name: "Café", icon: "☕", category: "drinks", regPrice: 2.00, memPrice: 1.50 },
    // Snacks
    { id: 9, name: "KIT KAT", icon: "🍫", category: "snacks", regPrice: 2.50, memPrice: 2.00 },
    { id: 10, name: "SNICKERS", icon: "🍫", category: "snacks", regPrice: 2.50, memPrice: 2.00 },
    { id: 11, name: "TWIX", icon: "🍫", category: "snacks", regPrice: 2.50, memPrice: 2.00 },
    { id: 12, name: "Pringles", icon: "🥔", category: "snacks", regPrice: 4.50, memPrice: 4.00 },
    // Sandwiches
    { id: 13, name: "Mista", icon: "🥪", category: "sandwiches", regPrice: 7.00, memPrice: 6.00, colabPrice: 2.00 },
    { id: 14, name: "Atum", icon: "🐟", category: "sandwiches", regPrice: 8.00, memPrice: 7.00, colabPrice: 2.00 },
    { id: 15, name: "Bacon & ovo", icon: "🥓", category: "sandwiches", regPrice: 8.00, memPrice: 7.00, colabPrice: 2.00 },
    { id: 16, name: "Frango", icon: "🍗", category: "sandwiches", regPrice: 8.00, memPrice: 7.00, colabPrice: 2.00 }
];

const StorageManager = {
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
            parsed = parsed.map(item => {
                const defaultItem = DEFAULT_CATALOG.find(d => d.id === item.id);
                return {
                    ...defaultItem,
                    ...item,
                    icon: item.icon || (defaultItem ? defaultItem.icon : "🏷️"),
                    category: item.category || (defaultItem ? defaultItem.category : "drinks"),
                    colabPrice: (defaultItem && defaultItem.colabPrice !== undefined) ? defaultItem.colabPrice : item.colabPrice
                };
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

    updateStock: (id, amount, log = true) => {
        const stockMap = StorageManager.getStock();
        const currentStock = stockMap[id] || 0;
        const newStock = Math.max(0, currentStock + amount);
        stockMap[id] = newStock;
        localStorage.setItem(STORAGE_KEYS.STOCK, JSON.stringify(stockMap));

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
            date: new Date().toISOString().split('T')[0],
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
            date: new Date().toISOString().split('T')[0],
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
            date: transaction.date || new Date().toISOString().split('T')[0],
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
        const todayStr = new Date().toISOString().split('T')[0];
        const preserved = history.filter(t => {
            const date = t.date || (t.timestamp ? t.timestamp.split('T')[0] : '');
            return date !== todayStr;
        });
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(preserved));
        return preserved;
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
