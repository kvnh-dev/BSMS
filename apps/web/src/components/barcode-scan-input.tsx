'use client';

import { useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api-client';

export interface ScannedInventoryItem {
  id: string;
  name: string;
  unitPrice: number;
  gstRate: number;
  stockQty: number;
  saleUnit: string | null;
  saleUnitFactor: number;
}

// A keyboard-wedge barcode/QR scanner is just a HID device that types the
// code + Enter into whatever's focused — so "scanning" only needs a plain
// text input that resolves a code to an item on Enter, no keystroke-timing
// detection required.
export function BarcodeScanInput({
  onFound,
  className,
  placeholder = 'Scan or type SKU/barcode, then Enter',
}: {
  onFound: (item: ScannedInventoryItem) => void;
  className?: string;
  placeholder?: string;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const item = await api.get<ScannedInventoryItem>(`/inventory/lookup?code=${encodeURIComponent(trimmed)}`);
      onFound(item);
      setCode('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No item matches that code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Input
      value={code}
      onChange={(e) => setCode(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={loading}
      className={className}
    />
  );
}
