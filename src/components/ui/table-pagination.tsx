import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePagination<T>(items: T[], pageSize = 10) {
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

    // Reset to page 1 whenever the data changes (e.g. search)
    const safePages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(page, safePages);

    const paginated = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, safePage, pageSize]);

    const rangeStart = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const rangeEnd = Math.min(safePage * pageSize, items.length);

    return {
        page: safePage,
        setPage,
        totalPages,
        paginated,
        rangeStart,
        rangeEnd,
        total: items.length,
        hasPagination: items.length > pageSize,
    };
}

// ── Pagination component ──────────────────────────────────────────────────────
interface TablePaginationProps {
    page: number;
    totalPages: number;
    rangeStart: number;
    rangeEnd: number;
    total: number;
    onPageChange: (p: number) => void;
}

export function TablePagination({
    page, totalPages, rangeStart, rangeEnd, total, onPageChange,
}: TablePaginationProps) {
    if (totalPages <= 1 && total <= 12) return null;

    // Build page numbers to show (max 5 visible, with dots)
    function getPageNumbers(): (number | "…")[] {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages: (number | "…")[] = [];
        const near = 2; // pages around current

        pages.push(1);
        if (page - near > 2) pages.push("…");
        for (let i = Math.max(2, page - near); i <= Math.min(totalPages - 1, page + near); i++) {
            pages.push(i);
        }
        if (page + near < totalPages - 1) pages.push("…");
        pages.push(totalPages);

        return pages;
    }

    const pageNums = getPageNumbers();

    return (
        <div className="flex items-center justify-between gap-4 flex-wrap mt-1 select-none">
            {/* Range label */}
            <p className="text-[12px] text-gray-400 font-medium">
                Showing{" "}
                <span className="font-semibold text-gray-600">{rangeStart}–{rangeEnd}</span>
                {" "}of{" "}
                <span className="font-semibold text-gray-600">{total}</span>
                {" "}entries
            </p>

            {/* Pills */}
            <div className="flex items-center gap-1">
                {/* Prev */}
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1}
                    className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 transition-all duration-150 border",
                        page === 1
                            ? "border-gray-100 text-gray-300 cursor-not-allowed bg-white"
                            : "border-gray-200 bg-white hover:bg-gray-50 hover:text-gray-800 hover:border-gray-300 active:scale-95"
                    )}
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {/* Page numbers */}
                {pageNums.map((num, i) =>
                    num === "…" ? (
                        <span key={`dot-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-[12px]">
                            …
                        </span>
                    ) : (
                        <button
                            key={num}
                            onClick={() => onPageChange(num as number)}
                            className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-semibold transition-all duration-150 border active:scale-95",
                                page === num
                                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-800 hover:border-gray-300"
                            )}
                        >
                            {num}
                        </button>
                    )
                )}

                {/* Next */}
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages}
                    className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 transition-all duration-150 border",
                        page === totalPages
                            ? "border-gray-100 text-gray-300 cursor-not-allowed bg-white"
                            : "border-gray-200 bg-white hover:bg-gray-50 hover:text-gray-800 hover:border-gray-300 active:scale-95"
                    )}
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
