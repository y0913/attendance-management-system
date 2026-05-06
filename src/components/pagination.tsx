import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Props {
  currentPage: number; // 1-indexed
  totalPages: number;
  buildHref: (page: number) => string;
  totalLabel?: string; // 例: "全 123 件"
}

export function Pagination({
  currentPage,
  totalPages,
  buildHref,
  totalLabel,
}: Props) {
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      className="flex items-center justify-between gap-3 text-sm"
      aria-label="ページ送り"
    >
      <span className="text-muted-foreground">
        {totalLabel
          ? `${totalLabel} ・ `
          : ''}
        {totalPages > 0
          ? `${currentPage} / ${totalPages} ページ`
          : '表示なし'}
      </span>
      <div className="flex items-center gap-1">
        <Button
          asChild={hasPrev}
          variant="outline"
          size="sm"
          disabled={!hasPrev}
        >
          {hasPrev ? (
            <Link href={buildHref(currentPage - 1)} aria-label="前のページ">
              ← 前へ
            </Link>
          ) : (
            <span>← 前へ</span>
          )}
        </Button>
        <Button
          asChild={hasNext}
          variant="outline"
          size="sm"
          disabled={!hasNext}
        >
          {hasNext ? (
            <Link href={buildHref(currentPage + 1)} aria-label="次のページ">
              次へ →
            </Link>
          ) : (
            <span>次へ →</span>
          )}
        </Button>
      </div>
    </nav>
  );
}
