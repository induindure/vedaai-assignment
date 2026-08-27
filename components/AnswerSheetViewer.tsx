"use client";

import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import HighlightOverlay, { type HighlightBox } from "@/components/HighlightOverlay";
import type { PageImageData } from "@/types/processing";

export interface HighlightRegion {
  page: number;
  bbox: [number, number, number, number];
  color?: "emerald" | "amber";
}

interface AnswerSheetViewerProps {
  pages: PageImageData[];
  currentPage: number;
  onPageChange: (page: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  highlightRegions: HighlightRegion[];
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

export default function AnswerSheetViewer({
  pages,
  currentPage,
  onPageChange,
  zoom,
  onZoomChange,
  highlightRegions,
}: AnswerSheetViewerProps) {
  const page = pages.find((p) => p.pageNumber === currentPage) ?? pages[0];
  const totalPages = pages.length;

  const boxesForPage: HighlightBox[] = highlightRegions
    .filter((region) => region.page === page?.pageNumber)
    .map(({ bbox, color }) => ({ bbox, color }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-1 pb-4">
        <h2 className="text-sm font-semibold text-neutral-800">Answer Sheet</h2>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-neutral-200 p-1">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(MIN_ZOOM, +(zoom - ZOOM_STEP).toFixed(2)))}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-30"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(1)}
              className="w-11 text-center text-xs font-medium text-neutral-600 hover:text-neutral-900"
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(MAX_ZOOM, +(zoom + ZOOM_STEP).toFixed(2)))}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-30"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-neutral-600">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="whitespace-nowrap">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-auto rounded-2xl bg-neutral-100 p-4">
        {page && (
          <div className="mx-auto" style={{ width: `${zoom * 100}%` }}>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI, not a static/remote asset next/image can optimize */}
              <img
                src={`data:${page.mimeType};base64,${page.imageBase64}`}
                alt={`Answer sheet page ${page.pageNumber}`}
                width={page.width}
                height={page.height}
                className="block w-full rounded-lg shadow-sm"
              />
              <HighlightOverlay boxes={boxesForPage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
