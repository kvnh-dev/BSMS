// All money in BSMS is stored as integer paise (see DATABASE_SCHEMA.md) to
// avoid float rounding errors in GST/invoice math. These are the only two
// places rupees<->paise conversion should happen — at the UI edges.

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatPaiseAsInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paiseToRupees(paise));
}

// GST rates are stored as integer basis points, e.g. 1800 = 18.00%.
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsInWords(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

function threeDigitsInWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (!hundred) return twoDigitsInWords(rest);
  return ONES[hundred] + ' Hundred' + (rest ? ' ' + twoDigitsInWords(rest) : '');
}

// Indian numbering (crore/lakh/thousand) — the convention GST invoices in
// India print the total in, spelled out as a fraud-prevention measure.
export function amountInWordsInr(paise: number): string {
  let rupees = Math.round(paiseToRupees(paise));
  if (rupees === 0) return 'Rupees Zero Only';

  const crore = Math.floor(rupees / 1e7);
  rupees %= 1e7;
  const lakh = Math.floor(rupees / 1e5);
  rupees %= 1e5;
  const thousand = Math.floor(rupees / 1e3);
  rupees %= 1e3;
  const hundred = rupees;

  const parts: string[] = [];
  if (crore) parts.push(threeDigitsInWords(crore) + ' Crore');
  if (lakh) parts.push(threeDigitsInWords(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigitsInWords(thousand) + ' Thousand');
  if (hundred) parts.push(threeDigitsInWords(hundred));

  return `Rupees ${parts.join(' ')} Only`;
}
