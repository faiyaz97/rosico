"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CompetitionRailItem = {
  id: string;
  name: string;
  imagePath?: string | null;
};

function mediaUrl(path: string) {
  return `/api/media/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function CompetitionRail({
  groupId,
  competitions,
  label = "Group competitions"
}: {
  groupId: string;
  competitions: CompetitionRailItem[];
  label?: string;
}) {
  const viewportRef = useRef<HTMLUListElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const remaining =
      viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft;
    setHasOverflow(viewport.scrollWidth - viewport.clientWidth > 1);
    setCanScrollBack(viewport.scrollLeft > 1);
    setCanScrollForward(remaining > 1);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [competitions, updateScrollState]);

  function scroll(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    viewport.scrollBy({
      left: direction * Math.max(220, viewport.clientWidth * 0.72),
      behavior: reducedMotion ? "auto" : "smooth"
    });
  }

  if (!competitions.length) return null;

  return (
    <nav
      className="competition-rail"
      aria-label={label}
      data-overflow={hasOverflow}
    >
      {hasOverflow && canScrollBack && (
        <button
          className="competition-rail-arrow competition-rail-arrow-previous"
          type="button"
          aria-label="Previous competitions"
          onClick={() => scroll(-1)}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      )}
      <ul
        className="competition-rail-viewport"
        ref={viewportRef}
        onScroll={updateScrollState}
      >
        {competitions.map((competition) => {
          const imageUrl = competition.imagePath
            ? mediaUrl(competition.imagePath)
            : undefined;
          return (
            <li key={competition.id}>
              <Link
                className="competition-rail-tile"
                href={`/app/groups/${groupId}/competitions/${competition.id}`}
              >
                <span
                  className={[
                    "competition-rail-image",
                    imageUrl ? "has-image" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                  style={
                    imageUrl
                      ? { backgroundImage: `url("${imageUrl}")` }
                      : undefined
                  }
                >
                  {!imageUrl &&
                    competition.name.trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="competition-rail-name">
                  {competition.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {hasOverflow && canScrollForward && (
        <button
          className="competition-rail-arrow competition-rail-arrow-next"
          type="button"
          aria-label="Next competitions"
          onClick={() => scroll(1)}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      )}
    </nav>
  );
}
