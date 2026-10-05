/** Amounts are integers in minor units (fils for AED) to avoid floating point errors. */

export function formatMoney(minor: number, currency: string): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const major = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, "0");
  return `${sign}${currency} ${major.toLocaleString("en-US")}.${cents}`;
}

/** VAT portion of a VAT-inclusive amount, e.g. 5% included in AED 105.00 is AED 5.00. */
export function vatIncludedIn(totalMinor: number, rate: number): number {
  if (rate <= 0) return 0;
  return Math.round((totalMinor * rate) / (1 + rate));
}

/** VAT to add on top of a VAT-exclusive amount. */
export function vatOnTopOf(netMinor: number, rate: number): number {
  if (rate <= 0) return 0;
  return Math.round(netMinor * rate);
}
