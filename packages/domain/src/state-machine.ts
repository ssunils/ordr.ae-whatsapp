import { z } from "zod";

export const StateMachineSchema = z.object({
  initial: z.string(),
  states: z.array(z.string()).min(1),
  transitions: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      /** Event name that triggers this transition, e.g. "accept", "cancel". */
      on: z.string(),
    }),
  ),
  terminal: z.array(z.string()).default([]),
});

export type StateMachine = z.infer<typeof StateMachineSchema>;

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly on: string,
  ) {
    super(`No transition from "${from}" on "${on}"`);
    this.name = "InvalidTransitionError";
  }
}

/** Validates that every transition references declared states and that the initial state exists. */
export function validateStateMachine(sm: StateMachine): string[] {
  const errors: string[] = [];
  const states = new Set(sm.states);
  if (!states.has(sm.initial)) errors.push(`initial state "${sm.initial}" is not declared`);
  for (const t of sm.transitions) {
    if (!states.has(t.from)) errors.push(`transition from undeclared state "${t.from}"`);
    if (!states.has(t.to)) errors.push(`transition to undeclared state "${t.to}"`);
  }
  for (const s of sm.terminal) {
    if (!states.has(s)) errors.push(`terminal state "${s}" is not declared`);
  }
  return errors;
}

export function nextState(sm: StateMachine, from: string, on: string): string {
  const t = sm.transitions.find((x) => x.from === from && x.on === on);
  if (!t) throw new InvalidTransitionError(from, on);
  return t.to;
}

export function canTransition(sm: StateMachine, from: string, on: string): boolean {
  return sm.transitions.some((x) => x.from === from && x.on === on);
}

export function isTerminal(sm: StateMachine, state: string): boolean {
  return sm.terminal.includes(state);
}
