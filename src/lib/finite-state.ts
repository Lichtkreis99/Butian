export function allFinite(values: Iterable<number>): boolean {
  for (const value of values) {
    if (!Number.isFinite(value)) return false;
  }
  return true;
}

export function finiteRecord(values: Record<string, number | readonly number[]>): boolean {
  return Object.values(values).every((value) =>
    typeof value === "number" ? Number.isFinite(value) : allFinite(value));
}
