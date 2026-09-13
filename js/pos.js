/**
 * POS (Point of Sale) logic for Buggy Bar app.
 * Handles category filtering (Drinks, Snacks, Sandwiches),
 * in-stock only filtering, compact Grid/List view switcher,
 * item icons, 3 price tiers (Regular, Member, Colaborador €2.00 for sandwiches),
 * quantity selection modal, cart management, tips, and checkout.
 */

let cart = [];
let cashTendered = 0;
let tipAmount = 0;
let currentCategory = 'all';
let currentViewMode = localStorage.getItem('bb_pos_view_mode') || 'grid'; // 'grid' or 'list'
let hideOutOfStock = localStorage.getItem('bb_pos_hide_out_of_stock') === 'true';

// Modal state
let modalCurrentItem = null;
let modalQuantity = 1;
let modalPriceType = 'reg'; // 'reg', 'mem', or 'colab'
let modalMaxAvailable = 0;

function initPOS() {
    initViewMode();
    initInStockToggle();
    initCategoryFilters();
    renderPosCatalog();
    renderCart();
    setupModalListeners();
    setupCashAndTipListeners();
    setupCheckoutListener();

    window.addEventListener('bb_stock_updated', () => {
        renderPosCatalog();
        renderCart();
    });
}

// -------------------------------------------------------------
// View Mode Switcher (Grid vs List)
// -------------------------------------------------------------
function initViewMode() {
    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');
    const container = document.getElementById('pos-items');

    const setMode = (mode) => {
        currentViewMode = mode;
        localStorage.setItem('bb_pos_view_mode', mode);

        if (container) {
            container.className = mode === 'grid' ? 'grid-view' : 'list-view';
        }

        if (btnGrid && btnList) {
            if (mode === 'grid') {
                btnGrid.className = 'p-1.5 rounded-md text-xs font-bold transition-all bg-white text-blue-600 shadow-2xs';
                btnList.className = 'p-1.5 rounded-md text-xs font-bold transition-all text-slate-600 hover:text-slate-900';
            } else {
                btnGrid.className = 'p-1.5 rounded-md text-xs font-bold transition-all text-slate-600 hover:text-slate-900';
                btnList.className = 'p-1.5 rounded-md text-xs font-bold transition-all bg-white text-blue-600 shadow-2xs';
            }
        }
        renderPosCatalog();
    };

    if (btnGrid) btnGrid.addEventListener('click', () => setMode('grid'));
    if (btnList) btnList.addEventListener('click', () => setMode('list'));

    setMode(currentViewMode);
}

// -------------------------------------------------------------
// In Stock Only Toggle
// -------------------------------------------------------------
function initInStockToggle() {
    const toggleBtn = document.getElementById('btn-toggle-in-stock');
    const iconSpan = document.getElementById('in-stock-icon');

    const updateToggleUI = () => {
        if (!toggleBtn) return;
        if (hideOutOfStock) {
            toggleBtn.className = 'px-2 py-1 text-xs font-bold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 transition-all flex items-center gap-1 shadow-2xs';
            if (iconSpan) iconSpan.textContent = '🟢';
        } else {
            toggleBtn.className = 'px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1 shadow-2xs';
            if (iconSpan) iconSpan.textContent = '⚪';
        }
    };

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            hideOutOfStock = !hideOutOfStock;
            localStorage.setItem('bb_pos_hide_out_of_stock', hideOutOfStock);
            updateToggleUI();
            renderPosCatalog();
            showToast(hideOutOfStock ? "Showing in-stock items only" : "Showing all items");
        });
    }

    updateToggleUI();
}

// -------------------------------------------------------------
// Category Filtering
// -------------------------------------------------------------
function initCategoryFilters() {
    const buttons = document.querySelectorAll('.category-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentCategory = btn.dataset.category || 'all';
            updateCategoryButtonStyles();
            renderPosCatalog();
        });
    });
    updateCategoryButtonStyles();
    updateCategoryCounts();
}

function updateCategoryButtonStyles() {
    const buttons = document.querySelectorAll('.category-btn');
    buttons.forEach(btn => {
        const isSelected = btn.dataset.category === currentCategory;
        if (isSelected) {
            btn.className = 'category-btn active px-3 py-1 text-xs font-bold rounded-full bg-blue-600 text-white border border-blue-600 whitespace-nowrap shadow-2xs';
        } else {
            btn.className = 'category-btn px-3 py-1 text-xs font-semibold rounded-full border border-slate-200 bg-white text-slate-700 hover:border-slate-300 whitespace-nowrap';
        }
    });
}

function updateCategoryCounts() {
    const catalog = StorageManager.getCatalog();
    const countAll = catalog.length;
    const countDrinks = catalog.filter(i => i.category === 'drinks').length;
    const countSnacks = catalog.filter(i => i.category === 'snacks').length;
    const countSandwiches = catalog.filter(i => i.category === 'sandwiches').length;

    const elAll = document.getElementById('cat-count-all');
    const elDrinks = document.getElementById('cat-count-drinks');
    const elSnacks = document.getElementById('cat-count-snacks');
    const elSandwiches = document.getElementById('cat-count-sandwiches');

    if (elAll) elAll.textContent = `(${countAll})`;
    if (elDrinks) elDrinks.textContent = `(${countDrinks})`;
    if (elSnacks) elSnacks.textContent = `(${countSnacks})`;
    if (elSandwiches) elSandwiches.textContent = `(${countSandwiches})`;
}

// -------------------------------------------------------------
// Product Catalog Rendering (Grid or List View)
// -------------------------------------------------------------
function renderPosCatalog() {
    const posItemsContainer = document.getElementById('pos-items');
    if (!posItemsContainer) return;

    const catalog = StorageManager.getCatalog();
    const stockMap = StorageManager.getStock();

    // 1. Filter by Category
    let filtered = currentCategory === 'all' 
        ? catalog 
        : catalog.filter(item => item.category === currentCategory);

    // 2. Filter by In-Stock Only if enabled
    if (hideOutOfStock) {
        filtered = filtered.filter(item => {
            const totalStock = stockMap[item.id] || 0;
            const inCartQty = cart.filter(c => c.itemId === item.id).reduce((sum, c) => sum + c.qty, 0);
            return (totalStock - inCartQty) > 0;
        });
    }

    posItemsContainer.innerHTML = '';

    if (filtered.length === 0) {
        posItemsContainer.innerHTML = `
            <div class="col-span-2 py-8 text-center text-slate-400 text-xs">
                ${hideOutOfStock ? 'No items currently in stock in this category.' : 'No items found.'}
            </div>
        `;
        return;
    }

    filtered.forEach(item => {
        const totalStock = stockMap[item.id] || 0;
        const inCartQty = cart.filter(c => c.itemId === item.id).reduce((sum, c) => sum + c.qty, 0);
        const availableStock = Math.max(0, totalStock - inCartQty);
        const isOutOfStock = availableStock <= 0;

        const card = document.createElement('div');
        const hasColab = item.colabPrice !== undefined;

        if (currentViewMode === 'grid') {
            // Compact Square Card View
            card.className = `p-2.5 rounded-xl border transition-all select-none flex flex-col justify-between ${
                isOutOfStock 
                    ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' 
                    : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-xs active:scale-[0.98] cursor-pointer'
            }`;

            card.innerHTML = `
                <div>
                    <div class="flex items-start justify-between gap-1 mb-1">
                        <span class="text-xl leading-none">${item.icon || '🏷️'}</span>
                        <span class="text-[10px] font-black px-1.5 py-0.2 rounded ${
                            availableStock > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                        }">
                            ${availableStock > 0 ? `${availableStock}` : '0'}
                        </span>
                    </div>
                    <h3 class="font-bold text-slate-900 text-xs leading-snug line-clamp-1">${item.name}</h3>
                    <div class="text-[11px] text-slate-500 mt-0.5 flex items-baseline gap-1 flex-wrap">
                        <span class="font-extrabold text-slate-800">€${item.regPrice.toFixed(2)}</span>
                        ${hasColab ? `<span class="text-[10px] text-purple-700 font-bold">· colab €${item.colabPrice.toFixed(2)}</span>` : ''}
                    </div>
                </div>
                <div class="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                    <span class="text-slate-400">mem €${item.memPrice.toFixed(2)}</span>
                    <span class="font-bold ${availableStock > 0 ? 'text-blue-600' : 'text-slate-300'}">
                        ${availableStock > 0 ? '+ Add' : '—'}
                    </span>
                </div>
            `;
        } else {
            // Dense Horizontal List Row View
            card.className = `p-2 rounded-lg border transition-all select-none flex items-center justify-between gap-2 ${
                isOutOfStock 
                    ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' 
                    : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-xs active:scale-[0.99] cursor-pointer'
            }`;

            card.innerHTML = `
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="text-xl flex-shrink-0">${item.icon || '🏷️'}</span>
                    <div class="min-w-0">
                        <h3 class="font-bold text-slate-900 text-xs truncate">${item.name}</h3>
                        <p class="text-[10px] text-slate-400">
                            Reg: <b class="text-slate-700">€${item.regPrice.toFixed(2)}</b> · Mem: €${item.memPrice.toFixed(2)}
                            ${hasColab ? ` · <span class="text-purple-700 font-bold">Colab: €${item.colabPrice.toFixed(2)}</span>` : ''}
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0">
                    <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        availableStock > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                    }">
                        ${availableStock > 0 ? `${availableStock} un` : 'Out'}
                    </span>
                    <button 
                        type="button" 
                        class="px-2 py-1 rounded bg-blue-600 text-white font-bold text-xs disabled:bg-slate-300"
                        ${isOutOfStock ? 'disabled' : ''}
                    >
                        +
                    </button>
                </div>
            `;
        }

        if (!isOutOfStock) {
            card.addEventListener('click', () => openQuantityModal(item, availableStock));
        } else {
            card.addEventListener('click', () => showToast(`⚠️ "${item.name}" is currently out of stock!`));
        }

        posItemsContainer.appendChild(card);
    });
}

// -------------------------------------------------------------
// Quantity Selection Modal (with 3 Price Tiers: Reg, Mem, Colab)
// -------------------------------------------------------------
function openQuantityModal(item, availableStock) {
    modalCurrentItem = item;
    modalMaxAvailable = availableStock;
    modalQuantity = 1;
    modalPriceType = 'reg';

    const modal = document.getElementById('modal-qty-picker');
    const iconSpan = document.getElementById('modal-item-icon');
    const title = document.getElementById('modal-item-title');
    const stockBadge = document.getElementById('modal-item-stock');
    const regPriceSpan = document.getElementById('modal-reg-price');
    const memPriceSpan = document.getElementById('modal-mem-price');
    const colabPriceSpan = document.getElementById('modal-colab-price');
    const btnPriceColab = document.getElementById('modal-btn-price-colab');
    const tierContainer = document.getElementById('modal-price-tier-container');

    if (!modal) return;

    if (iconSpan) iconSpan.textContent = item.icon || '📦';
    title.textContent = item.name;
    stockBadge.textContent = `Available: ${availableStock} units`;
    regPriceSpan.textContent = `€${item.regPrice.toFixed(2)}`;
    memPriceSpan.textContent = `€${item.memPrice.toFixed(2)}`;

    // If item has Colaborador price (e.g. sandwiches €2.00), show 3rd option
    if (item.colabPrice !== undefined && btnPriceColab) {
        btnPriceColab.classList.remove('hidden');
        if (colabPriceSpan) colabPriceSpan.textContent = `€${item.colabPrice.toFixed(2)}`;
        if (tierContainer) {
            tierContainer.classList.remove('grid-cols-2');
            tierContainer.classList.add('grid-cols-3');
        }
    } else if (btnPriceColab) {
        btnPriceColab.classList.add('hidden');
        if (tierContainer) {
            tierContainer.classList.remove('grid-cols-3');
            tierContainer.classList.add('grid-cols-2');
        }
    }

    updateModalUI();
    modal.classList.remove('hidden');
}

function closeQuantityModal() {
    const modal = document.getElementById('modal-qty-picker');
    if (modal) modal.classList.add('hidden');
    modalCurrentItem = null;
}

function updateModalUI() {
    const qtyDisplay = document.getElementById('modal-qty-display');
    const subtotalDisplay = document.getElementById('modal-item-subtotal');
    const btnPriceReg = document.getElementById('modal-btn-price-reg');
    const btnPriceMem = document.getElementById('modal-btn-price-mem');
    const btnPriceColab = document.getElementById('modal-btn-price-colab');
    const minusBtn = document.getElementById('modal-btn-qty-minus');
    const plusBtn = document.getElementById('modal-btn-qty-plus');

    if (!modalCurrentItem) return;

    minusBtn.disabled = modalQuantity <= 1;
    plusBtn.disabled = modalQuantity >= modalMaxAvailable;
    minusBtn.classList.toggle('opacity-40', modalQuantity <= 1);
    plusBtn.classList.toggle('opacity-40', modalQuantity >= modalMaxAvailable);

    qtyDisplay.textContent = modalQuantity;

    // Reset styles
    const inactiveClass = "py-2 px-2 border border-slate-200 bg-white text-slate-700 font-semibold rounded-lg text-xs flex flex-col items-center hover:border-slate-300";
    if (btnPriceReg) btnPriceReg.className = inactiveClass;
    if (btnPriceMem) btnPriceMem.className = inactiveClass;
    if (btnPriceColab) btnPriceColab.className = inactiveClass;

    // Highlight selected tier
    if (modalPriceType === 'reg' && btnPriceReg) {
        btnPriceReg.className = "py-2 px-2 border-2 border-blue-600 bg-blue-50 text-blue-700 font-bold rounded-lg text-xs flex flex-col items-center";
    } else if (modalPriceType === 'mem' && btnPriceMem) {
        btnPriceMem.className = "py-2 px-2 border-2 border-blue-600 bg-blue-50 text-blue-700 font-bold rounded-lg text-xs flex flex-col items-center";
    } else if (modalPriceType === 'colab' && btnPriceColab) {
        btnPriceColab.className = "py-2 px-2 border-2 border-purple-600 bg-purple-50 text-purple-800 font-bold rounded-lg text-xs flex flex-col items-center";
    }

    let unitPrice = modalCurrentItem.regPrice;
    if (modalPriceType === 'mem') unitPrice = modalCurrentItem.memPrice;
    if (modalPriceType === 'colab' && modalCurrentItem.colabPrice !== undefined) {
        unitPrice = modalCurrentItem.colabPrice;
    }

    const subtotal = unitPrice * modalQuantity;
    subtotalDisplay.textContent = `€${subtotal.toFixed(2)}`;
}

function setupModalListeners() {
    const btnClose = document.getElementById('btn-close-qty-modal');
    const btnCancel = document.getElementById('btn-cancel-qty');
    const btnMinus = document.getElementById('modal-btn-qty-minus');
    const btnPlus = document.getElementById('modal-btn-qty-plus');
    const btnPriceReg = document.getElementById('modal-btn-price-reg');
    const btnPriceMem = document.getElementById('modal-btn-price-mem');
    const btnPriceColab = document.getElementById('modal-btn-price-colab');
    const btnConfirm = document.getElementById('btn-confirm-add-qty');

    if (btnClose) btnClose.addEventListener('click', closeQuantityModal);
    if (btnCancel) btnCancel.addEventListener('click', closeQuantityModal);

    if (btnMinus) {
        btnMinus.addEventListener('click', () => {
            if (modalQuantity > 1) {
                modalQuantity--;
                updateModalUI();
            }
        });
    }

    if (btnPlus) {
        btnPlus.addEventListener('click', () => {
            if (modalQuantity < modalMaxAvailable) {
                modalQuantity++;
                updateModalUI();
            } else {
                showToast(`Max available stock reached (${modalMaxAvailable})`);
            }
        });
    }

    if (btnPriceReg) {
        btnPriceReg.addEventListener('click', () => {
            modalPriceType = 'reg';
            updateModalUI();
        });
    }

    if (btnPriceMem) {
        btnPriceMem.addEventListener('click', () => {
            modalPriceType = 'mem';
            updateModalUI();
        });
    }

    if (btnPriceColab) {
        btnPriceColab.addEventListener('click', () => {
            modalPriceType = 'colab';
            updateModalUI();
        });
    }

    if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
            if (!modalCurrentItem || modalQuantity <= 0) return;

            let unitPrice = modalCurrentItem.regPrice;
            if (modalPriceType === 'mem') unitPrice = modalCurrentItem.memPrice;
            if (modalPriceType === 'colab' && modalCurrentItem.colabPrice !== undefined) {
                unitPrice = modalCurrentItem.colabPrice;
            }

            const existing = cart.find(c => c.itemId === modalCurrentItem.id && c.priceType === modalPriceType);

            if (existing) {
                existing.qty += modalQuantity;
                existing.subtotal = existing.qty * existing.unitPrice;
            } else {
                cart.push({
                    itemId: modalCurrentItem.id,
                    name: modalCurrentItem.name,
                    icon: modalCurrentItem.icon || '📦',
                    qty: modalQuantity,
                    priceType: modalPriceType,
                    unitPrice: unitPrice,
                    subtotal: unitPrice * modalQuantity
                });
            }

            closeQuantityModal();
            renderCart();
            renderPosCatalog();
            showToast(`Added ${modalQuantity}x ${modalCurrentItem.name}`);
        });
    }
}

// -------------------------------------------------------------
// Cart, Tips & Checkout
// -------------------------------------------------------------
function renderCart() {
    const cartListContainer = document.getElementById('cart-list');
    const cartSubtotalElement = document.getElementById('cart-subtotal');
    const cartTotalElement = document.getElementById('cart-total');
    const cartCountElement = document.getElementById('cart-item-count');
    const tipAmountDisplay = document.getElementById('tip-amount-display');

    if (!cartListContainer || !cartTotalElement) return;

    cartListContainer.innerHTML = '';
    let itemsSubtotal = 0;
    let totalUnits = 0;

    if (cart.length === 0) {
        cartListContainer.innerHTML = `
            <div class="py-5 text-center text-slate-400 text-xs">
                🛒 Your order is empty.<br>Tap items above to add.
            </div>
        `;
        tipAmount = 0;
    } else {
        cart.forEach((item, index) => {
            const lineSubtotal = item.unitPrice * item.qty;
            itemsSubtotal += lineSubtotal;
            totalUnits += item.qty;

            let badgeClass = 'bg-slate-100 text-slate-600';
            let badgeLabel = 'Reg';
            if (item.priceType === 'mem') {
                badgeClass = 'bg-blue-100 text-blue-800';
                badgeLabel = 'Mem';
            } else if (item.priceType === 'colab') {
                badgeClass = 'bg-purple-100 text-purple-800';
                badgeLabel = 'Colab';
            }

            const row = document.createElement('div');
            row.className = 'flex items-center justify-between py-1.5 border-b border-slate-100 last:border-b-0 text-xs';
            row.innerHTML = `
                <div class="flex-1 pr-2">
                    <div class="flex items-center gap-1 font-bold text-slate-900">
                        <span>${item.icon || ''}</span>
                        <span>${item.name}</span>
                        <span class="text-[9px] px-1 py-0.2 rounded font-bold ${badgeClass}">
                            ${badgeLabel}
                        </span>
                    </div>
                    <div class="text-[10px] text-slate-400">
                        €${item.unitPrice.toFixed(2)} each
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <div class="flex items-center gap-1 bg-slate-100 rounded p-0.5 border border-slate-200">
                        <button 
                            type="button" 
                            onclick="handleCartQtyChange(${index}, -1)" 
                            class="w-5 h-5 flex items-center justify-center font-bold text-slate-700 hover:bg-white rounded"
                        >
                            -
                        </button>
                        <span class="w-5 text-center font-bold text-slate-900 text-xs">${item.qty}</span>
                        <button 
                            type="button" 
                            onclick="handleCartQtyChange(${index}, 1)" 
                            class="w-5 h-5 flex items-center justify-center font-bold text-slate-700 hover:bg-white rounded"
                        >
                            +
                        </button>
                    </div>

                    <div class="w-12 text-right font-bold text-slate-900 text-xs">
                        €${lineSubtotal.toFixed(2)}
                    </div>

                    <button 
                        type="button" 
                        onclick="handleRemoveFromCart(${index})" 
                        class="text-slate-400 hover:text-rose-600 font-bold px-1"
                    >
                        ✕
                    </button>
                </div>
            `;
            cartListContainer.appendChild(row);
        });
    }

    const grandTotal = itemsSubtotal + tipAmount;

    if (cartSubtotalElement) cartSubtotalElement.textContent = `€${itemsSubtotal.toFixed(2)}`;
    if (tipAmountDisplay) tipAmountDisplay.textContent = `€${tipAmount.toFixed(2)}`;
    cartTotalElement.textContent = `€${grandTotal.toFixed(2)}`;

    if (cartCountElement) {
        cartCountElement.textContent = `${totalUnits} item${totalUnits === 1 ? '' : 's'}`;
    }

    updateCashAndChangeUI(itemsSubtotal, grandTotal);
}

window.handleCartQtyChange = (index, delta) => {
    const item = cart[index];
    if (!item) return;

    if (delta > 0) {
        const stockMap = StorageManager.getStock();
        const totalStock = stockMap[item.itemId] || 0;
        const inCart = cart.filter(c => c.itemId === item.itemId).reduce((s, c) => s + c.qty, 0);

        if (inCart >= totalStock) {
            showToast(`⚠️ No more stock available for ${item.name}!`);
            return;
        }
        item.qty += 1;
    } else {
        item.qty -= 1;
        if (item.qty <= 0) {
            cart.splice(index, 1);
        }
    }

    renderCart();
    renderPosCatalog();
};

window.handleRemoveFromCart = (index) => {
    cart.splice(index, 1);
    renderCart();
    renderPosCatalog();
};

document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
    if (cart.length === 0) return;
    if (confirm("Clear the current order?")) {
        cart = [];
        tipAmount = 0;
        resetCashInput();
        renderCart();
        renderPosCatalog();
    }
});

// -------------------------------------------------------------
// Tip & Cash Tender Listeners
// -------------------------------------------------------------
function setupCashAndTipListeners() {
    const cashInput = document.getElementById('cash-received');
    if (cashInput) {
        cashInput.addEventListener('input', (e) => {
            cashTendered = parseFloat(e.target.value) || 0;
            const itemsSubtotal = getItemsSubtotal();
            const grandTotal = itemsSubtotal + tipAmount;
            updateCashAndChangeUI(itemsSubtotal, grandTotal);
        });
    }

    // Quick cash shortcuts
    const quickCashBtns = document.querySelectorAll('.quick-cash-btn');
    quickCashBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = btn.dataset.amount;
            const itemsSubtotal = getItemsSubtotal();
            const grandTotal = itemsSubtotal + tipAmount;
            let newCash = 0;

            if (amount === 'exact') {
                newCash = grandTotal;
            } else {
                newCash = parseFloat(amount) || 0;
            }

            if (cashInput) {
                cashInput.value = newCash > 0 ? newCash.toFixed(2) : '';
            }
            cashTendered = newCash;
            updateCashAndChangeUI(itemsSubtotal, grandTotal);
        });
    });

    // Tip buttons
    const tipBtns = document.querySelectorAll('.tip-btn');
    tipBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tipVal = btn.dataset.tip;
            const itemsSubtotal = getItemsSubtotal();

            tipBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (tipVal === 'keep_change') {
                if (cashTendered > itemsSubtotal) {
                    tipAmount = cashTendered - itemsSubtotal;
                } else {
                    tipAmount = 0;
                    showToast("Tender cash first to calculate change as tip!");
                }
            } else {
                tipAmount = parseFloat(tipVal) || 0;
            }

            renderCart();
        });
    });
}

function getItemsSubtotal() {
    return cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
}

function resetCashInput() {
    cashTendered = 0;
    const cashInput = document.getElementById('cash-received');
    if (cashInput) cashInput.value = '';
}

function updateCashAndChangeUI(itemsSubtotal, grandTotal) {
    const changeElement = document.getElementById('change-returned');
    const changeLabel = document.getElementById('change-label');
    const checkoutBtn = document.getElementById('btn-checkout');
    if (!changeElement || !checkoutBtn) return;

    if (cart.length === 0 || grandTotal <= 0) {
        changeElement.textContent = '€0.00';
        changeElement.className = 'text-lg font-black text-slate-400';
        if (changeLabel) changeLabel.textContent = 'Change Due:';
        checkoutBtn.disabled = true;
        return;
    }

    const difference = cashTendered - grandTotal;

    if (difference >= 0) {
        changeElement.textContent = `€${difference.toFixed(2)}`;
        changeElement.className = 'text-lg font-black text-emerald-600';
        if (changeLabel) changeLabel.textContent = 'Change Due:';
        checkoutBtn.disabled = false;
    } else {
        const missing = Math.abs(difference);
        changeElement.textContent = `-€${missing.toFixed(2)}`;
        changeElement.className = 'text-lg font-black text-rose-500';
        if (changeLabel) changeLabel.textContent = 'Shortfall:';
        checkoutBtn.disabled = true;
    }
}

// -------------------------------------------------------------
// Checkout
// -------------------------------------------------------------
function setupCheckoutListener() {
    const checkoutBtn = document.getElementById('btn-checkout');
    if (!checkoutBtn) return;

    checkoutBtn.addEventListener('click', () => {
        const itemsSubtotal = getItemsSubtotal();
        const grandTotal = itemsSubtotal + tipAmount;

        if (cart.length === 0) {
            alert("Cart is empty!");
            return;
        }

        if (cashTendered < grandTotal) {
            alert(`Insufficient cash tendered. Total with tip is €${grandTotal.toFixed(2)}.`);
            return;
        }

        const change = cashTendered - grandTotal;

        const transaction = {
            date: new Date().toISOString().split('T')[0],
            items: cart.map(item => ({
                itemId: item.itemId,
                name: item.name,
                icon: item.icon || '📦',
                qty: item.qty,
                priceType: item.priceType,
                unitPrice: item.unitPrice,
                subtotal: item.unitPrice * item.qty
            })),
            itemsSubtotal: itemsSubtotal,
            tip: tipAmount,
            total: grandTotal,
            cashReceived: cashTendered,
            changeGiven: change
        };

        // Deduct purchased quantities from stock
        cart.forEach(item => {
            StorageManager.updateStock(item.itemId, -item.qty, false);
        });

        // Save transaction
        StorageManager.saveTransaction(transaction);

        // Reset state
        cart = [];
        tipAmount = 0;
        resetCashInput();
        renderCart();
        renderPosCatalog();

        window.dispatchEvent(new CustomEvent('bb_stock_updated'));
        window.dispatchEvent(new CustomEvent('bb_history_updated'));

        const tipMsg = transaction.tip > 0 ? ` (Tip: €${transaction.tip.toFixed(2)})` : '';
        showToast(`🎉 Order completed! Change: €${change.toFixed(2)}${tipMsg}`);
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('toast-slide');

    setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('toast-slide');
    }, 2800);
}

window.showToast = showToast;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPOS);
} else {
    initPOS();
}
