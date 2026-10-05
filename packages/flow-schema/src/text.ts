import type { I18nText } from "./schema";

/** Picks the copy for a language, falling back to the default language and then to any value. */
export function resolveText(t: I18nText | undefined, language: string, defaultLanguage: string): string {
  if (t === undefined) return "";
  if (typeof t === "string") return t;
  return t[language] ?? t[defaultLanguage] ?? Object.values(t)[0] ?? "";
}

/** Reads a dotted path like "item.title" or "cart.0.qty" from a context object. */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Replaces {{ path }} placeholders with context values. Missing values become empty strings. */
export function interpolate(templateText: string, context: Record<string, unknown>): string {
  return templateText.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const v = getPath(context, path);
    if (v === undefined || v === null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  });
}

/** Recursively interpolates string values inside action params. */
export function interpolateDeep<T>(value: T, context: Record<string, unknown>): T {
  if (typeof value === "string") {
    // A param that is exactly one placeholder keeps the original type (object, number, array).
    const whole = /^\{\{\s*([\w.]+)\s*\}\}$/.exec(value);
    if (whole) return getPath(context, whole[1]!) as T;
    return interpolate(value, context) as T;
  }
  if (Array.isArray(value)) return value.map((v) => interpolateDeep(v, context)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = interpolateDeep(v, context);
    return out as T;
  }
  return value;
}

const ARABIC = /[؀-ۿ]/;

/** Cheap script-based language guess for the first message of a conversation. */
export function detectLanguage(textValue: string, supported: string[], fallback: string): string {
  if (ARABIC.test(textValue) && supported.includes("ar")) return "ar";
  return supported.includes(fallback) ? fallback : (supported[0] ?? fallback);
}
