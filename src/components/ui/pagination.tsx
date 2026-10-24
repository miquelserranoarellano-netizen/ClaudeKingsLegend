import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { t } from "@/i18n";
import { cn } from "@/lib/cn";

/** Paginación por enlaces (funciona sin JavaScript y cada página tiene su URL). */
export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const item = "inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold";
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 pt-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, "text-ink-2 hover:bg-surface-2")} rel="prev">
          <ChevronLeft aria-hidden className="size-4" /> {t("common.previous")}
        </Link>
      ) : (
        <span className={cn(item, "text-ink-3/50")} aria-hidden>
          <ChevronLeft className="size-4" /> {t("common.previous")}
        </span>
      )}
      <span className="text-sm text-ink-3 tabular">{t("common.page", { page, total: pageCount })}</span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={cn(item, "text-ink-2 hover:bg-surface-2")} rel="next">
          {t("common.next")} <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span className={cn(item, "text-ink-3/50")} aria-hidden>
          {t("common.next")} <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
