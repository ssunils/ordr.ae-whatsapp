import { describe, expect, it } from "vitest";
import { buttons, list, MessageLimitError, text } from "./outbound";

describe("outbound builders", () => {
  it("builds a buttons message", () => {
    const msg = buttons("Pick one", [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
    ]);
    expect(msg.interactive.action.buttons).toHaveLength(2);
    expect(msg.interactive.action.buttons[0]).toEqual({ type: "reply", reply: { id: "a", title: "A" } });
  });

  it("rejects more than three buttons", () => {
    const four = ["a", "b", "c", "d"].map((id) => ({ id, title: id }));
    expect(() => buttons("x", four)).toThrow(MessageLimitError);
  });

  it("rejects button titles over 20 characters", () => {
    expect(() => buttons("x", [{ id: "a", title: "This title is far too long" }])).toThrow(MessageLimitError);
  });

  it("rejects lists with more than ten rows", () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, title: `Row ${i}` }));
    expect(() => list("x", "Choose", [{ rows }])).toThrow(MessageLimitError);
  });

  it("rejects duplicate row ids", () => {
    expect(() =>
      list("x", "Choose", [
        { rows: [{ id: "r", title: "One" }] },
        { rows: [{ id: "r", title: "Two" }] },
      ]),
    ).toThrow(/duplicate row id/);
  });

  it("rejects empty text", () => {
    expect(() => text("   ")).toThrow(MessageLimitError);
  });
});
