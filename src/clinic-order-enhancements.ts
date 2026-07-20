const enhanceClinicOrderCards = () => {
  if (!window.location.pathname.startsWith('/clinic/order')) return;

  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('main .grid > .glass-panel.rounded-card')
  );

  cards.forEach((card) => {
    const productImage = card.querySelector('img');

    // Only show products that are backed by one of the uploaded catalog images.
    if (!productImage) {
      card.style.display = 'none';
      return;
    }

    const quantityInput = card.querySelector<HTMLInputElement>('input[type="number"]');
    if (quantityInput) {
      const quantityRow = quantityInput.closest('.flex.items-center.justify-between');
      if (quantityRow instanceof HTMLElement) quantityRow.style.display = 'none';
    }

    const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('button'));
    const addButton = buttons.find((button) =>
      /add to cart|add to order/i.test(button.textContent || '')
    );

    if (addButton && !/add to order/i.test(addButton.textContent || '')) {
      addButton.innerHTML = '<i class="fa fa-cart-plus mr-2"></i> Add to Order';
      addButton.setAttribute('aria-label', 'Add to Order');
    }
  });
};

let scheduled = false;
const scheduleEnhancement = () => {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    enhanceClinicOrderCards();
  });
};

const observer = new MutationObserver(scheduleEnhancement);

window.addEventListener('DOMContentLoaded', () => {
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleEnhancement();
});

window.addEventListener('popstate', scheduleEnhancement);
