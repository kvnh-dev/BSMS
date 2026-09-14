// Per DATABASE_SCHEMA.md: customers are local-only for this showroom, so
// CGST/SGST always applies (split evenly) and igstPaise is always 0.
// If inter-state customers are ever supported, this is the only function
// that needs to branch on customer state.

export interface GstBreakup {
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

export interface LineItemInput {
  qty: number;
  unitPricePaise: number;
  gstRateBps: number;
}

/** Taxable value (pre-GST) for a single line item, in paise. */
export function lineItemTaxableValue(line: LineItemInput): number {
  return line.qty * line.unitPricePaise;
}

/** Total GST for a single line item, in paise. */
export function lineItemGstAmount(line: LineItemInput): number {
  return Math.round((lineItemTaxableValue(line) * line.gstRateBps) / 10000);
}

/** Combines line items into a single CGST/SGST breakup (local-only assumption). */
export function calcGstBreakup(lines: LineItemInput[]): GstBreakup {
  const totalGst = lines.reduce((sum, line) => sum + lineItemGstAmount(line), 0);
  const half = Math.round(totalGst / 2);
  return {
    cgstPaise: half,
    sgstPaise: totalGst - half, // remainder absorbs any rounding difference
    igstPaise: 0,
  };
}

export function calcInvoiceTotal(lines: LineItemInput[], discountPaise = 0): number {
  const taxable = lines.reduce((sum, line) => sum + lineItemTaxableValue(line), 0);
  const gst = lines.reduce((sum, line) => sum + lineItemGstAmount(line), 0);
  return taxable + gst - discountPaise;
}
