const CLINIC_ORDER_PATH = '/clinic/order';
const HIDDEN_PRODUCT_CODES = new Set(['EXEMPT-BOX']);
const HIDDEN_PRODUCT_NAMES = new Set(['exempt human specimen box']);
const UNIT_LABELS = new Set(['each', 'kit', 'box', 'pack', 'case', 'roll']);

function normalizedText(value: string | null | undefined) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isHiddenProductCard(card: HTMLElement) {
  const text = normalizedText(card.textContent);
  return Array.from(HIDDEN_PRODUCT_CODES).some((code) => text.includes(code.toLowerCase()))
    || Array.from(HIDDEN_PRODUCT_NAMES).some((name) => text.includes(name));
}

function hideUnitBadges(card: HTMLElement) {
  const candidates = Array.from(card.querySelectorAll<HTMLElement>('span, p, div'));
  candidates.forEach((candidate) => {
    if (candidate.children.length > 0) return;
    if (!UNIT_LABELS.has(normalizedText(candidate.textContent))) return;
    candidate.style.display = 'none';
    candidate.setAttribute('aria-hidden', 'true');
  });
}

function ensureAddToOrderButton(card: HTMLElement) {
  const quantityInput = card.querySelector<HTMLInputElement>('input[type="number"]');
  if (!quantityInput) return;

  const quantityRow = quantityInput.closest<HTMLElement>('.flex.items-center.justify-between')
    || quantityInput.parentElement;
  if (!quantityRow) return;

  const rowButtons = Array.from(quantityRow.querySelectorAll<HTMLButtonElement>('button'));
  const plusButton = rowButtons.find((button) => normalizedText(button.textContent) === '+')
    || rowButtons[rowButtons.length - 1];

  let addButton = Array.from(card.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
    /add to cart|add to order/i.test(button.textContent || '')
  );

  if (!addButton && plusButton) {
    addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'btn-primary w-full mt-4 clinic-add-to-order-button';
    addButton.textContent = 'Add to Order';
    addButton.setAttribute('aria-label', 'Add one item to order');
    addButton.addEventListener('click', () => {
      plusButton.click();
      addButton!.textContent = 'Added';
      window.setTimeout(() => {
        if (addButton?.isConnected) addButton.textContent = 'Add to Order';
      }, 700);
    });
    quantityRow.insertAdjacentElement('afterend', addButton);
  } else if (addButton) {
    addButton.textContent = 'Add to Order';
    addButton.setAttribute('aria-label', 'Add one item to order');
  }

  quantityRow.style.display = 'none';
  quantityRow.setAttribute('aria-hidden', 'true');
}

function enhanceClinicOrderCards() {
  if (!window.location.pathname.startsWith(CLINIC_ORDER_PATH)) return;

  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('main .grid > .glass-panel.rounded-card')
  );

  cards.forEach((card) => {
    if (isHiddenProductCard(card)) {
      card.style.display = 'none';
      card.setAttribute('aria-hidden', 'true');
      return;
    }

    hideUnitBadges(card);
    ensureAddToOrderButton(card);
  });
}

let scheduled = false;
function scheduleEnhancement() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    enhanceClinicOrderCards();
  });
}

const observer = new MutationObserver(scheduleEnhancement);

window.addEventListener('DOMContentLoaded', () => {
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleEnhancement();
});

window.addEventListener('popstate', scheduleEnhancement);
