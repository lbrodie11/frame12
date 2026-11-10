/** Formats cents as dollars: 2500 → "$25.00". */
export function formatCents(cents) {
  if (!Number.isInteger(cents)) throw new TypeError('cents must be an integer');
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Sums line items in cents. */
export function totalCents(items) {
  return items.reduce((sum, item) => sum + item.cents * (item.quantity ?? 1), 0);
}
