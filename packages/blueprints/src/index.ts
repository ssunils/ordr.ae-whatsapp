import type { Blueprint } from "@ordr/flow-schema";
import { restaurant } from "./restaurant";

export { restaurant };

export const blueprints: Record<string, Blueprint> = {
  [restaurant.id]: restaurant,
};

export function getBlueprint(id: string): Blueprint | undefined {
  return blueprints[id];
}
