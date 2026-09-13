/**
 * Navigation logic for Buggy Bar POS app.
 * Handles tab switching between POS, Stock, and History sections,
 * and ensures data is freshly rendered on tab switch.
 */

const initNavigation = () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes from all tabs
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.classList.remove('text-blue-600');
            });
            tabContents.forEach(content => {
                content.classList.remove('active');
            });

            // Add active class to clicked tab
            btn.classList.add('active');
            btn.classList.add('text-blue-600');

            // Show corresponding content
            const targetId = btn.id.replace('tab-', '');
            const targetContent = document.getElementById(`content-${targetId}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }

            // Freshly re-render the activated tab
            if (targetId === 'pos' && typeof renderPosCatalog === 'function') {
                renderPosCatalog();
                if (typeof renderCart === 'function') renderCart();
            } else if (targetId === 'stock' && typeof renderStockManagement === 'function') {
                renderStockManagement();
            } else if (targetId === 'history' && typeof renderHistory === 'function') {
                renderHistory();
            }
        });
    });
};

// Initialize navigation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
} else {
    initNavigation();
}