import { useState, type FormEvent } from "react";
import type { EntityMeta, FieldMeta } from "@power-app/core/meta";
import { Button, Input, Label, Select, Textarea } from "./ui";

type Values = Record<string, unknown>;

interface EntityFormProps {
  meta: EntityMeta;
  initialValues?: Values;
  submitLabel: string;
  onSubmit: (values: Values) => Promise<void>;
  onCancel: () => void;
  /** Field-level validation issues keyed by field name. */
  fieldErrors?: Record<string, string>;
}

function toInputValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldMeta;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const common = {
    id: field.name,
    name: field.name,
    required: field.required,
    placeholder: field.placeholder,
  };

  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          {...common}
          value={toInputValue(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return (
        <Select
          {...common}
          value={toInputValue(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled={field.required}>
            Select…
          </option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      );
    case "boolean":
      return (
        <input
          id={field.name}
          name={field.name}
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case "number":
      return (
        <Input
          {...common}
          type="number"
          value={toInputValue(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      );
    case "date":
    case "datetime":
      return (
        <Input
          {...common}
          type={field.type === "date" ? "date" : "datetime-local"}
          value={toInputValue(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <Input
          {...common}
          type={field.type === "email" ? "email" : "text"}
          value={toInputValue(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export function EntityForm({
  meta,
  initialValues = {},
  submitLabel,
  onSubmit,
  onCancel,
  fieldErrors = {},
}: EntityFormProps) {
  const editable = meta.fields.filter((f) => !f.readOnly);
  const [values, setValues] = useState<Values>(() => {
    const seed: Values = {};
    for (const field of editable) seed[field.name] = initialValues[field.name] ?? "";
    return seed;
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (name: string, v: unknown) =>
    setValues((prev) => ({ ...prev, [name]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Drop empty optional values so server defaults apply.
      const payload: Values = {};
      for (const [k, v] of Object.entries(values)) {
        if (v !== "" && v !== null && v !== undefined) payload[k] = v;
      }
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {editable.map((field) => (
        <div key={field.name}>
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="ml-0.5 text-destructive">*</span>}
          </Label>
          <FieldControl
            field={field}
            value={values[field.name]}
            onChange={(v) => set(field.name, v)}
          />
          {field.helpText && (
            <p className="mt-1 text-xs text-muted-foreground">{field.helpText}</p>
          )}
          {fieldErrors[field.name] && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors[field.name]}</p>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
