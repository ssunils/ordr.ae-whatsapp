import { describe, expect, it } from "vitest";
import { canTransition, InvalidTransitionError, nextState, validateStateMachine } from "./state-machine";

const sm = {
  initial: "placed",
  states: ["placed", "accepted", "cancelled"],
  transitions: [
    { from: "placed", to: "accepted", on: "accept" },
    { from: "placed", to: "cancelled", on: "cancel" },
  ],
  terminal: ["cancelled"],
};

describe("state machine", () => {
  it("validates a well-formed machine", () => {
    expect(validateStateMachine(sm)).toEqual([]);
  });

  it("reports undeclared states", () => {
    const bad = { ...sm, transitions: [{ from: "placed", to: "shipped", on: "ship" }] };
    expect(validateStateMachine(bad)).toEqual(['transition to undeclared state "shipped"']);
  });

  it("moves along declared transitions and rejects others", () => {
    expect(nextState(sm, "placed", "accept")).toBe("accepted");
    expect(canTransition(sm, "accepted", "cancel")).toBe(false);
    expect(() => nextState(sm, "accepted", "cancel")).toThrow(InvalidTransitionError);
  });
});
