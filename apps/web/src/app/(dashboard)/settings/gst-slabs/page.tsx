'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bpsToPercent } from '@bsms/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, ApiError } from '@/lib/api-client';

interface GstSlab {
  id: string;
  label: string;
  rate: number;
  isDefault: boolean;
}

export default function GstSlabsPage() {
  const queryClient = useQueryClient();

  const { data: slabs, isLoading } = useQuery({
    queryKey: ['gst-slabs'],
    queryFn: () => api.get<GstSlab[]>('/gst-slabs'),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/gst-slabs/${id}`, { isDefault: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gst-slabs'] }),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/gst-slabs/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gst-slabs'] }),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Delete failed'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">GST Slabs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure the GST rate presets available when adding inventory items.
          </p>
        </div>
        <Link href="/settings/gst-slabs/new">
          <Button>Add slab</Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Default</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {slabs?.map((slab) => (
              <TableRow key={slab.id}>
                <TableCell className="font-medium">{slab.label}</TableCell>
                <TableCell>{bpsToPercent(slab.rate)}%</TableCell>
                <TableCell>
                  {slab.isDefault ? (
                    <Badge>Default</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setDefaultMutation.mutate(slab.id)}>
                      Make default
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(slab.id)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
