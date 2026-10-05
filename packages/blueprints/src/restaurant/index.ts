import { type BlueprintInput, parseBlueprint } from "@ordr/flow-schema";
import blueprint from "./blueprint.json";
import language from "./flows/language.json";
import mainMenu from "./flows/main_menu.json";
import orderFood from "./flows/order_food.json";
import talkToUs from "./flows/talk_to_us.json";
import trackOrder from "./flows/track_order.json";

export const restaurant = parseBlueprint({
  ...(blueprint as Omit<BlueprintInput, "flows">),
  flows: [mainMenu, orderFood, trackOrder, talkToUs, language],
} as BlueprintInput);
