const PLACEHOLDER_VALUES = new Set([
  "[]",
  "{}",
  "null",
  "none",
  "undefined",
  "-",
  "n/a",
  "na",
]);

export const cleanListValues = (values = []) =>
  (Array.isArray(values) ? values : [])
    .map((item) => String(item ?? "").trim())
    .filter((item) => item && !PLACEHOLDER_VALUES.has(item.toLowerCase()));

export const parseDelimitedList = (value, separator) =>
  String(value ?? "")
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item && !PLACEHOLDER_VALUES.has(item.toLowerCase()));
