/** snake_case → already snake; camelCase/PascalCase → snake_case. */
export function snake(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

/** "work_orders" / "workOrders" → "Work Orders". */
export function titleCase(input: string): string {
  return snake(input)
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Naive singularization sufficient for labels: assets→asset, policies→policy. */
export function singularize(input: string): string {
  if (/ies$/i.test(input)) return input.replace(/ies$/i, "y");
  if (/sses$/i.test(input)) return input.replace(/es$/i, "");
  if (/s$/i.test(input) && !/ss$/i.test(input)) return input.replace(/s$/i, "");
  return input;
}
