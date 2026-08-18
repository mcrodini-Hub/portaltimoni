"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

type DateTimeInputProps = Omit<DateInputProps, "placeholder" | "inputMode" | "maxLength">;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function isoToBrazilian(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function formatTypedDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length <= 6) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

function brazilianToIso(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 6 && digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.length === 6 ? `20${digits.slice(4)}` : digits.slice(4));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function BrazilianDateInput({ value, onChange, onBlur, className, ...props }: DateInputProps) {
  const [display, setDisplay] = useState(() => isoToBrazilian(value));

  useEffect(() => setDisplay(isoToBrazilian(value)), [value]);

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      maxLength={10}
      placeholder="DD/MM/AAAA"
      value={display}
      className={className}
      onChange={(event) => {
        const nextDisplay = formatTypedDate(event.target.value);
        setDisplay(nextDisplay);
        if (!nextDisplay) onChange("");
        const iso = brazilianToIso(nextDisplay);
        if (iso) onChange(iso);
      }}
      onBlur={(event) => {
        const iso = brazilianToIso(display);
        if (iso) {
          setDisplay(isoToBrazilian(iso));
          onChange(iso);
          event.currentTarget.setCustomValidity("");
        } else if (display) {
          event.currentTarget.setCustomValidity("Informe uma data válida no formato DD/MM/AAAA.");
          event.currentTarget.reportValidity();
        } else event.currentTarget.setCustomValidity("");
        onBlur?.(event);
      }}
    />
  );
}

export function BrazilianDateTimeInput({ value, onChange, className, disabled, required, ...props }: DateTimeInputProps) {
  const [date = "", time = ""] = value.split("T");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
      <BrazilianDateInput {...props} value={date} disabled={disabled} required={required} className={className} onChange={(nextDate) => onChange(nextDate ? `${nextDate}T${time || "00:00"}` : "")} />
      <input type="time" value={time} disabled={disabled} required={required} aria-label="Horário" className={className} onChange={(event) => onChange(date ? `${date}T${event.target.value}` : "")} />
    </div>
  );
}
