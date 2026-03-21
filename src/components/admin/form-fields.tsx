"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  placeholder?: string;
  required?: boolean;
}) {
  const t = useT();
  return (
    <div className="admin-form-group">
      <label>
        {label}
        {required && <span className="pf-required">*</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder ?? t.admin.selectPlaceholder}</option>
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="admin-form-group">
      <label>
        {label}
        {required && <span className="pf-required">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  step,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  step?: string;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="admin-form-group">
      <label>
        {label}
        {suffix && <span className="pf-suffix"> ({suffix})</span>}
      </label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        placeholder={placeholder}
        step={step ?? "any"}
        min={min}
        max={max}
      />
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="pf-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function MultiSelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: Record<string, string>;
}) {
  function toggle(key: string) {
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key));
    } else {
      onChange([...value, key]);
    }
  }

  return (
    <div className="admin-form-group">
      <label>{label}</label>
      <div className="pf-multi-select">
        {Object.entries(options).map(([k, v]) => (
          <label key={k} className="pf-multi-option">
            <input
              type="checkbox"
              checked={value.includes(k)}
              onChange={() => toggle(k)}
            />
            <span>{v}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="admin-form-group">
      <label>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 4}
      />
    </div>
  );
}

export function TagsField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const t = useT();
  const [input, setInput] = useState("");

  function addTag() {
    const tag = input.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  }

  function removeTag(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="admin-form-group">
      <label>{label}</label>
      <div className="pf-tags-wrap">
        <div className="pf-tags">
          {value.map((tag, i) => (
            <span key={i} className="pf-tag">
              {tag}
              <button type="button" onClick={() => removeTag(i)}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <div className="pf-tags-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={placeholder ?? t.admin.addPlaceholder}
          />
          <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={addTag}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}
