/**
 * Navigation logic for Buggy Bar POS app.
 * Handles tab switching between POS, Stock, and History sections,
 * directional sliding animations, and mobile swipe gestures.
 */

const TABS = ['pos', 'stock', 'history'];
let currentTabIndex = 0;

function switchTab(targetTab, forcedDirection = null) {
    const nextIndex = typeof targetTab === 'number' ? targetTab : TABS.indexOf(targetTab);
    if (nextIndex < 0 || nextIndex >= TABS.length) return;
    if (nextIndex === currentTabIndex && forcedDirection === null) return;

    const prevIndex = currentTabIndex;
    currentTabIndex = nextIndex;
    const tabName = TABS[nextIndex];

    // Determine slide direction
    const direction = forcedDirection || (nextIndex > prevIndex ? 'right' : 'left');

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Update Tab Buttons
    tabBtns.forEach(b => {
        b.classList.remove('active');
        b.classList.remove('text-blue-600');
    });

    const activeBtn = document.getElementById(`tab-${tabName}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.classList.add('text-blue-600');
    }

    // Update Tab Contents with Directional Slide
    tabContents.forEach(content => {
        content.classList.remove('active', 'slide-in-right', 'slide-in-left');
    });

    const targetContent = document.getElementById(`content-${tabName}`);
    if (targetContent) {
        targetContent.classList.add('active');
        const animClass = direction === 'right' ? 'slide-in-right' : 'slide-in-left';
        targetContent.classList.add(animClass);
    }

    // Freshly re-render activated tab
    if (tabName === 'pos' && typeof renderPosCatalog === 'function') {
        renderPosCatalog();
        if (typeof renderCart === 'function') renderCart();
    } else if (tabName === 'stock' && typeof renderStockManagement === 'function') {
        renderStockManagement();
    } else if (tabName === 'history' && typeof renderHistory === 'function') {
        renderHistory();
    }
}

const initNavigation = () => {
    // 1. Click Listeners on Tab Buttons
    TABS.forEach(tabName => {
        const btn = document.getElementById(`tab-${tabName}`);
        if (btn) {
            btn.addEventListener('click', () => {
                switchTab(tabName);
            });
        }
    });

    // 2. Mobile Swipe Gestures on Main Container
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isTouchActive = false;

    mainEl.addEventListener('touchstart', (e) => {
        // Ignore if touching inside an open modal
        const openModal = document.querySelector('.modal-backdrop:not(.hidden)');
        if (openModal) return;

        // Ignore if touch started on horizontal scroll container or interactive inputs
        const target = e.target;
        if (target.closest('#category-filter-bar') || 
            target.closest('input') || 
            target.closest('textarea') ||
            target.closest('select')) {
            return;
        }

        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        isTouchActive = true;
    }, { passive: true });

    mainEl.addEventListener('touchend', (e) => {
        if (!isTouchActive) return;
        isTouchActive = false;

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        const deltaTime = Date.now() - touchStartTime;

        // Require quick swipe with primarily horizontal motion
        const minDistance = 45;
        const maxTime = 600;

        if (deltaTime > maxTime) return;
        if (Math.abs(deltaX) < minDistance) return;
        if (Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return; // Must be predominantly horizontal

        if (deltaX < 0) {
            // Swiped Left -> Move to Next Tab
            if (currentTabIndex < TABS.length - 1) {
                switchTab(currentTabIndex + 1, 'right');
            }
        } else {
            // Swiped Right -> Move to Previous Tab
            if (currentTabIndex > 0) {
                switchTab(currentTabIndex - 1, 'left');
            }
        }
    }, { passive: true });
};

window.switchTab = switchTab;

// Initialize navigation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
} else {
    initNavigation();
}