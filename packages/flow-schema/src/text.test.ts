import { describe, expect, it } from "vitest";
import { detectLanguage, interpolate, interpolateDeep, resolveText } from "./text";

describe("text helpers", () => {
  it("resolves localized copy with fallbacks", () => {
    expect(resolveText({ en: "Hi", ar: "مرحبا" }, "ar", "en")).toBe("مرحبا");
    expect(resolveText({ en: "Hi" }, "ar", "en")).toBe("Hi");
    expect(resolveText("plain", "ar", "en")).toBe("plain");
  });

  it("interpolates nested paths and blanks missing values", () => {
    const ctx = { item: { title: "Shawarma" }, qty: 2 };
    expect(interpolate("{{qty}} x {{ item.title }} {{missing}}", ctx)).toBe("2 x Shawarma ");
  });

  it("keeps types for whole-placeholder params", () => {
    const ctx = { category: { id: "c1", title: "Burgers" }, n: 3 };
    expect(interpolateDeep({ cat: "{{category}}", label: "n={{n}}" }, ctx)).toEqual({ cat: { id: "c1", title: "Burgers" }, label: "n=3" });
  });

  it("detects Arabic script", () => {
    expect(detectLanguage("مرحبا", ["en", "ar"], "en")).toBe("ar");
    expect(detectLanguage("hello", ["en", "ar"], "en")).toBe("en");
    expect(detectLanguage("مرحبا", ["en"], "en")).toBe("en");
  });
});
