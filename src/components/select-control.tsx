"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectControlOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

export function SelectControl({
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  required = false,
  id,
  ariaLabel,
  placeholder = "Choose an option"
}: {
  name?: string;
  options: SelectControlOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const generatedId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? options.find((option) => !option.disabled)?.value ?? ""
  );
  const currentValue = controlled ? value : internalValue;
  const selected = options.find((option) => option.value === currentValue);
  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options]
  );
  const selectedEnabledIndex = Math.max(
    0,
    enabledOptions.findIndex((option) => option.value === currentValue)
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedEnabledIndex);
  const [invalid, setInvalid] = useState(false);
  const controlId = id ?? generatedId;
  const activeOption = open ? enabledOptions[activeIndex] : undefined;
  const activeOptionIndex = activeOption
    ? options.findIndex((option) => option.value === activeOption.value)
    : -1;
  const activeOptionId =
    activeOptionIndex >= 0
      ? `${listboxId}-option-${activeOptionIndex}`
      : undefined;

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  function choose(nextValue: string) {
    if (!controlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    setInvalid(false);
    setOpen(false);
  }

  function moveActive(direction: 1 | -1) {
    if (!enabledOptions.length) return;
    setActiveIndex((current) => {
      const normalized = Math.min(current, enabledOptions.length - 1);
      return (
        (normalized + direction + enabledOptions.length) % enabledOptions.length
      );
    });
  }

  return (
    <div className="custom-select" ref={rootRef}>
      {name && !disabled && (
        <select
          className="custom-select-native"
          name={name}
          value={currentValue}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          onChange={() => undefined}
          onInvalid={(event) => {
            event.preventDefault();
            setInvalid(true);
            setOpen(true);
            triggerRef.current?.focus();
          }}
        >
          <option value="" />
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
      )}
      <button
        ref={triggerRef}
        id={controlId}
        className="custom-select-trigger"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={activeOptionId}
        aria-invalid={invalid || undefined}
        aria-required={required}
        disabled={disabled}
        onClick={() => {
          if (!open) setActiveIndex(selectedEnabledIndex);
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (event.key === "Tab") {
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              setActiveIndex(selectedEnabledIndex);
            } else {
              moveActive(event.key === "ArrowDown" ? 1 : -1);
            }
            return;
          }
          if (event.key === "Enter" && open && enabledOptions[activeIndex]) {
            event.preventDefault();
            choose(enabledOptions[activeIndex].value);
          }
        }}
      >
        <span className={selected ? undefined : "custom-select-placeholder"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="custom-select-options"
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const enabledIndex = enabledOptions.findIndex(
              (candidate) => candidate.value === option.value
            );
            const highlighted =
              !option.disabled && enabledIndex === activeIndex;
            return (
              <button
                key={option.value}
                id={`${listboxId}-option-${options.indexOf(option)}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={option.value === currentValue}
                aria-disabled={option.disabled || undefined}
                disabled={option.disabled}
                data-highlighted={highlighted || undefined}
                onMouseEnter={() => {
                  if (enabledIndex >= 0) setActiveIndex(enabledIndex);
                }}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {option.value === currentValue && (
                  <Check size={16} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
