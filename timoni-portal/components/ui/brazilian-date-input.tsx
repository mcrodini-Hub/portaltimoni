"use client";

import type { InputHTMLAttributes } from "react";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

type DateTimeInputProps = Omit<DateInputProps, "placeholder" | "inputMode" | "maxLength">;

export function BrazilianDateInput({ value, onChange, className, ...props }: DateInputProps) {
  return (
    <input
      {...props}
      type="date"
      lang="pt-BR"
      value={value}
      className={className}
      onChange={(event) => onChange(event.target.value)}
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
