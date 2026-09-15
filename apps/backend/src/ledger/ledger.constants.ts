// Fixed, seeded chart of accounts — not user-editable. See LedgerService.
export const SEEDED_ACCOUNTS = [
  { name: 'Sales', type: 'INCOME' },
  { name: 'Purchases', type: 'EXPENSE' },
  { name: 'GST Payable', type: 'LIABILITY' },
  { name: 'GST Receivable', type: 'ASSET' },
  { name: 'Cash/Bank', type: 'ASSET' },
  { name: 'Sundry Debtors', type: 'ASSET' },
  { name: 'Sundry Creditors', type: 'LIABILITY' },
  { name: 'Discount Allowed', type: 'EXPENSE' },
  { name: 'Discount Received', type: 'INCOME' },
  { name: 'Indirect Expenses', type: 'EXPENSE' },
] as const;

export type AccountName = (typeof SEEDED_ACCOUNTS)[number]['name'];
