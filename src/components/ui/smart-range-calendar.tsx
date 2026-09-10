import * as React from "react";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";

interface SmartRangeCalendarProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  disabled?: (date: Date) => boolean;
  numberOfMonths?: number;
  className?: string;
}

const DBLCLICK_MS = 350;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a?: Date, b?: Date) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Smart range calendar:
 * - Defaults to {today, today} (today "locked")
 * - Single click on date X → {from: X, to: X} (instant single-day result)
 * - Next click on different date Y → {from: min, to: max} (smooth range)
 * - Double click (≤350ms) same date → resets to today lock
 */
export function SmartRangeCalendar({ value, onChange, disabled, numberOfMonths = 1, className }: SmartRangeCalendarProps) {
  const lastClickRef = React.useRef<{ date: Date; time: number } | null>(null);

  const handleDayClick = React.useCallback(
    (day: Date, modifiers: { disabled?: boolean }) => {
      if (modifiers.disabled) return;
      const now = Date.now();
      const last = lastClickRef.current;

      // Double-click on the same date → reset to today lock
      if (last && sameDay(last.date, day) && now - last.time <= DBLCLICK_MS) {
        const today = startOfToday();
        onChange({ from: today, to: today });
        lastClickRef.current = null;
        return;
      }

      lastClickRef.current = { date: day, time: now };

      const from = value?.from;
      const to = value?.to;
      const isSingleSelected = from && to && sameDay(from, to);

      // If current state is a single-day pick (or empty), extend to range on different-date click
      if (isSingleSelected && !sameDay(from, day)) {
        const a = from!;
        const b = day;
        const [lo, hi] = a.getTime() <= b.getTime() ? [a, b] : [b, a];
        onChange({ from: lo, to: hi });
        return;
      }

      // If current state is a multi-day range, a new click collapses back to single day
      // Also fresh single click sets {day, day}
      onChange({ from: day, to: day });
    },
    [value, onChange]
  );

  return (
    <Calendar
      mode="range"
      selected={value}
      onDayClick={handleDayClick}
      disabled={disabled}
      numberOfMonths={numberOfMonths}
      initialFocus
      className={className ?? "p-3 pointer-events-auto"}
    />
  );
}
