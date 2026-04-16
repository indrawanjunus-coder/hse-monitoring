import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DEFAULT_PAGE_SIZE_OPTIONS = [20, 50];

export function Pagination({ page, total, pageSize, onPage, onPageSize, pageSizeOptions }: {
  page: number; total: number; pageSize: number;
  onPage: (p: number) => void; onPageSize: (n: number) => void;
  pageSizeOptions?: number[];
}) {
  const options = pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between pt-4 mt-2 border-t text-sm text-gray-600">
      <div className="flex items-center gap-2">
        <span>Tampilkan</span>
        {options.map(n => (
          <Button key={n} size="sm" variant={pageSize === n ? "default" : "outline"} className="h-7 px-2 text-xs"
            onClick={() => { onPageSize(n); onPage(1); }}>
            {n}
          </Button>
        ))}
        <span>per halaman · {total} total</span>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="px-2">{page} / {totalPages}</span>
        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
