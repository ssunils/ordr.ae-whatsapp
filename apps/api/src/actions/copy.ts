/** Small localized strings used by action handlers when composing text for the customer. */
export const COPY = {
  cartTitle: { en: "Your cart:", ar: "سلتك:" },
  cartEmpty: { en: "Your cart is empty.", ar: "سلتك فارغة." },
  subtotal: { en: "Subtotal", ar: "المجموع الفرعي" },
  deliveryFee: { en: "Delivery", ar: "التوصيل" },
  vatIncluded: { en: "Includes VAT", ar: "شامل ضريبة القيمة المضافة" },
  vat: { en: "VAT", ar: "ضريبة القيمة المضافة" },
  total: { en: "Total", ar: "الإجمالي" },
  noThanks: { en: "No thanks", ar: "لا شكراً" },
  orderPlaced: { en: "Order #{{number}} placed. Thank you!", ar: "تم تسجيل الطلب رقم {{number}}. شكراً لك!" },
  payCashDelivery: { en: "Please pay {{total}} in cash on delivery.", ar: "يرجى دفع {{total}} نقداً عند التوصيل." },
  payCashPickup: { en: "Please pay {{total}} when you collect your order.", ar: "يرجى دفع {{total}} عند استلام طلبك." },
  weWillUpdate: { en: "We will message you here as your order progresses.", ar: "سنرسل لك التحديثات هنا مع تقدم طلبك." },
  orderStatus: { en: "Order #{{number}} is {{status}}. Total {{total}}.", ar: "الطلب رقم {{number}} حالته: {{status}}. الإجمالي {{total}}." },
  statuses: {
    en: {
      placed: "received and waiting for confirmation",
      accepted: "confirmed",
      preparing: "being prepared",
      ready: "ready",
      out_for_delivery: "on its way",
      delivered: "delivered",
      completed: "completed",
      cancelled: "cancelled",
      rejected: "rejected",
    },
    ar: {
      placed: "تم استلامه وبانتظار التأكيد",
      accepted: "مؤكد",
      preparing: "قيد التحضير",
      ready: "جاهز",
      out_for_delivery: "في الطريق إليك",
      delivered: "تم التوصيل",
      completed: "مكتمل",
      cancelled: "ملغي",
      rejected: "مرفوض",
    },
  } as Record<string, Record<string, string>>,
} as const;

type Copy = Record<string, string>;

export function t(copy: Copy, language: string, vars: Record<string, string | number> = {}): string {
  const template = copy[language] ?? copy.en ?? Object.values(copy)[0] ?? "";
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ""));
}

export function statusLabel(status: string, language: string): string {
  return COPY.statuses[language]?.[status] ?? COPY.statuses.en?.[status] ?? status.replace(/_/g, " ");
}
