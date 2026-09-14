'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatPaiseAsInr, bpsToPercent } from '@bsms/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarcodeScanInput, type ScannedInventoryItem } from '@/components/barcode-scan-input';
import { FormField } from '@/components/form-field';
import { Kbd } from '@/components/kbd';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  hsnCode: string;
  gstRate: number;
  unitPrice: number;
  stockQty: number;
  reorderPoint: number;
  sku: string | null;
}

export default function InventoryPage() {
  const router = useRouter();
  const { hasPersona } = useAuth();
  const canEdit = hasPersona('OWNER');

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<InventoryItem[]>('/inventory'),
  });

  function jumpToScannedItem(item: ScannedInventoryItem) {
    router.push(`/inventory/${item.id}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        {canEdit && (
          <Link href="/inventory/new">
            <Button>
              Add item
              <Kbd className="ml-1.5 border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground shadow-none">
                F7
              </Kbd>
            </Button>
          </Link>
        )}
      </div>

      <FormField label="Find by SKU / barcode" className="flex flex-col gap-1.5 mb-4 max-w-sm">
        <BarcodeScanInput onFound={jumpToScannedItem} />
      </FormField>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>HSN</TableHead>
              <TableHead>GST</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items?.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/inventory/${item.id}`)}
              >
                <TableCell className="font-medium">
                  <Link
                    href={`/inventory/${item.id}`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.sku ?? '—'}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>{item.hsnCode}</TableCell>
                <TableCell>{bpsToPercent(item.gstRate)}%</TableCell>
                <TableCell className="text-right">{formatPaiseAsInr(item.unitPrice)}</TableCell>
                <TableCell className="text-right">
                  <span className={item.stockQty <= item.reorderPoint ? 'text-destructive font-medium' : ''}>
                    {item.stockQty}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {items?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No inventory items yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
