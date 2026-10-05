import { describe, expect, it } from "vitest";
import { addItem, cartCount, describeCart, emptyCart, quote, removeItem } from "./cart";
import { formatMoney, vatIncludedIn } from "./money";

const shawarma = { offeringId: "sh", title: "Chicken Shawarma", quantity: 2, unitPriceMinor: 1800, modifiers: [] };
const large = { groupId: "size", optionId: "large", title: "Large", priceDeltaMinor: 500 };

describe("money", () => {
  it("formats minor units", () => {
    expect(formatMoney(1800, "AED")).toBe("AED 18.00");
    expect(formatMoney(123456, "AED")).toBe("AED 1,234.56");
    expect(formatMoney(5, "AED")).toBe("AED 0.05");
  });
  it("extracts included VAT", () => {
    expect(vatIncludedIn(10500, 0.05)).toBe(500);
  });
});

describe("cart", () => {
  it("adds lines and computes totals with modifiers", () => {
    let cart = addItem(emptyCart("AED"), shawarma);
    cart = addItem(cart, { ...shawarma, quantity: 1, modifiers: [large] });
    expect(cart.items).toHaveLength(2);
    expect(cart.items[0]?.lineTotalMinor).toBe(3600);
    expect(cart.items[1]?.lineTotalMinor).toBe(2300);
    expect(cart.subtotalMinor).toBe(5900);
    expect(cartCount(cart)).toBe(3);
  });

  it("merges identical lines", () => {
    let cart = addItem(emptyCart("AED"), shawarma);
    cart = addItem(cart, shawarma);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.quantity).toBe(4);
  });

  it("removes lines", () => {
    const cart = removeItem(addItem(emptyCart("AED"), shawarma), 0);
    expect(cart.items).toHaveLength(0);
    expect(cart.subtotalMinor).toBe(0);
  });

  it("describes the cart for a text message", () => {
    const cart = addItem(emptyCart("AED"), { ...shawarma, quantity: 1, modifiers: [large] });
    expect(describeCart(cart)).toBe("1 x Chicken Shawarma (Large)  AED 23.00");
  });

  it("quotes delivery with inclusive VAT and pickup without a fee", () => {
    const cart = addItem(emptyCart("AED"), shawarma);
    const delivery = quote(cart, { fulfillmentType: "delivery", deliveryFeeMinor: 1000, vatRate: 0.05 });
    expect(delivery).toMatchObject({ deliveryFeeMinor: 1000, totalMinor: 4600, vatMinor: 219 });
    const pickup = quote(cart, { fulfillmentType: "pickup", deliveryFeeMinor: 1000, vatRate: 0.05 });
    expect(pickup).toMatchObject({ deliveryFeeMinor: 0, totalMinor: 3600 });
    const exclusive = quote(cart, { fulfillmentType: "pickup", vatRate: 0.05, vatInclusive: false });
    expect(exclusive.totalMinor).toBe(3780);
  });
});
