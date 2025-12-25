// Stripe Price Configuration
export const STRIPE_PRICES = {
  quick_prep: {
    price_id: "price_1SUJpOCoFieNARvY61k4XFm3",
    product_id: "prod_TRCDC8O6IowCTt",
    amount: 12,
    name: "Quick Prep",
  },
  full_mock: {
    price_id: "price_1SUJX1CoFieNARvYE286d1lq",
    product_id: "prod_TRBu6M8bak09fs",
    amount: 29,
    name: "Full Mock Interview",
  },
  premium_audio: {
    price_id: "price_1SUJwECoFieNARvYch9Y4PAY",
    product_id: "prod_TRCKHSMLl5Mt3u",
    amount: 49,
    name: "Premium Audio Mock",
  },
  pro: {
    price_id: "price_1SX74aCoFieNARvY06cE5g5e",
    product_id: "prod_TU5Fk4PhaDmLJN",
    amount: 79,
    name: "Pro Subscription",
    recurring: true,
  },
} as const;

export type SessionType = keyof typeof STRIPE_PRICES;
