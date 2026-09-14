'use client';

import { SHORTCUTS } from '@/lib/shortcuts-registry';
import { Kbd } from '@/components/kbd';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Every row here is sourced from the actual implementation (shortcuts-registry.ts,
// plus the two contextual shortcuts below that aren't plain route/action
// dispatches) — so this page can never claim a shortcut works when it doesn't.
export default function ShortcutsPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Keyboard Shortcuts</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Aligned to Tally where a clean equivalent exists — jump straight to the highest-frequency
          actions from anywhere in the app, no mouse required.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Global shortcuts</CardTitle>
          <CardDescription>Work from any screen in BSMS.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Key</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SHORTCUTS.map((s) => (
                <TableRow key={s.combo}>
                  <TableCell>
                    <Kbd>{s.combo}</Kbd>
                  </TableCell>
                  <TableCell>{s.label}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>
                  <Kbd>Alt+C</Kbd>
                </TableCell>
                <TableCell>
                  Create master on the fly — focus a customer, inventory item, category, GST slab, or
                  technician field and press it to add a new one inline, Tally-style. Does nothing
                  outside a relevant field.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Kbd>Page Up</Kbd> / <Kbd>Page Down</Kbd>
                </TableCell>
                <TableCell>On a detail page, move to the previous/next record in its list.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Kbd>Esc</Kbd>
                </TableCell>
                <TableCell>Close the open panel, or navigate back one level.</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4 max-w-2xl">
        More shortcuts (per-screen print/export mnemonics, list keyboard navigation) are planned — this
        page always reflects only what's live today.
      </p>
    </div>
  );
}
