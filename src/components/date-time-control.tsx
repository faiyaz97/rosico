"use client";

import { useId, useRef } from "react";
import { CalendarDays } from "lucide-react";

export function DateTimeControl({
  name,
  value,
  onValueChange,
  id,
  ariaLabel
}: {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
}) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const controlId = id ?? generatedId;

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if ("showPicker" in input) {
      try {
        input.showPicker();
      } catch {
        // The focused native field remains fully usable when a browser blocks
        // programmatic picker opening.
      }
    }
  }

  return (
    <span className="date-time-control">
      <input
        ref={inputRef}
        id={controlId}
        type="datetime-local"
        name={name}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <button
        type="button"
        aria-label="Open date and time picker"
        onClick={openPicker}
      >
        <CalendarDays size={18} aria-hidden="true" />
      </button>
    </span>
  );
}
