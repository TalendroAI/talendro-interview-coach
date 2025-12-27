# Resume Optimizer Developer Guidelines
## Technical Reference for Talendro Resume Optimizer Implementation

---

## Table of Contents
1. [Brand Standards & Design System](#1-brand-standards--design-system)
2. [Database Schema Requirements](#2-database-schema-requirements)
3. [Discount & Pricing System](#3-discount--pricing-system)
4. [Stripe Integration](#4-stripe-integration)
5. [Edge Function Patterns](#5-edge-function-patterns)
6. [Admin Dashboard Integration](#6-admin-dashboard-integration)
7. [Component Patterns](#7-component-patterns)
8. [Security Requirements](#8-security-requirements)

---

## 1. Brand Standards & Design System

### Typography (MUST MATCH EXACTLY)
```css
/* Headlines: Montserrat Bold */
font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
font-weight: 700;

/* Body Text: Inter Regular */
font-family: 'Inter', system-ui, -apple-system, sans-serif;
font-weight: 400;

/* Taglines/Callouts: DM Serif Display Italic */
font-family: 'DM Serif Display', serif;
font-style: italic;
```

### Color Palette (EXACT HEX VALUES)
| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--tal-blue` | #2F6DF6 | 220 91% 57% | Primary CTAs, links, headlines |
| `--tal-aqua` | #00C4CC | 183 100% 40% | Accents, highlights, ™ symbol |
| `--tal-lime` | #A4F400 | 79 100% 48% | Success states (sparingly) |
| `--tal-navy` | #0F172A | 222 47% 11% | Headlines, body text, footer |
| `--tal-slate` | #2C2F38 | 225 12% 20% | Body text |
| `--tal-gray` | #9FA6B2 | 218 11% 66% | Secondary/muted text |
| `--tal-soft` | #F4F7FF | 224 100% 98% | Section backgrounds |

### CSS Variables Structure
```css
:root {
  /* Brand Colors */
  --tal-blue: 220 91% 57%;
  --tal-aqua: 183 100% 40%;
  --tal-lime: 79 100% 48%;
  --tal-navy: 222 47% 11%;
  --tal-slate: 225 12% 20%;
  --tal-gray: 218 11% 66%;
  --tal-soft: 224 100% 98%;
  
  /* Semantic Tokens (map to brand) */
  --primary: 220 91% 57%;
  --primary-foreground: 0 0% 100%;
  --secondary: 183 100% 40%;
  --secondary-foreground: 0 0% 100%;
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --muted: 224 100% 98%;
  --muted-foreground: 218 11% 66%;
  --border: 220 20% 90%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  
  --radius: 0.5rem;
}
```

### Dark Mode Values
```css
.dark {
  --background: 222 47% 8%;
  --foreground: 224 100% 98%;
  --card: 222 47% 11%;
  --primary: 220 91% 62%;
  --secondary: 183 100% 45%;
  --muted: 222 47% 15%;
  --border: 222 47% 20%;
}
```

### CRITICAL: Never Use Direct Colors
```tsx
// ❌ WRONG - Direct colors
<div className="bg-white text-black">

// ✅ CORRECT - Semantic tokens
<div className="bg-background text-foreground">
<div className="bg-card text-card-foreground">
<div className="bg-muted text-muted-foreground">
```

---

## 2. Database Schema Requirements

### Required Tables

#### `optimizer_sessions` (equivalent to `coaching_sessions`)
```sql
CREATE TABLE public.optimizer_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  session_type session_type NOT NULL,  -- Use enum or create new one
  status session_status NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  profile_id UUID REFERENCES profiles(id),
  
  -- Resume-specific fields
  resume_text TEXT,
  optimized_resume TEXT,
  analysis_results JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.optimizer_sessions ENABLE ROW LEVEL SECURITY;
```

#### RLS Policies Pattern
```sql
-- Admin view all
CREATE POLICY "Admins can view all sessions"
ON public.optimizer_sessions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role for edge functions
CREATE POLICY "Service role can insert sessions"
ON public.optimizer_sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update sessions"
ON public.optimizer_sessions FOR UPDATE
USING (true);

-- Users view own (IMPORTANT: check auth.uid() IS NOT NULL)
CREATE POLICY "Users can view their own sessions"
ON public.optimizer_sessions FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND auth.uid() = profile_id
);
```

### Shared Tables (Already Exist - USE THESE)
- `discount_codes` - Promo codes (shared across products)
- `discount_code_usage` - Usage tracking (shared)
- `profiles` - User profiles (shared)
- `user_roles` - Admin roles (shared)
- `error_logs` - Error tracking (shared)

---

## 3. Discount & Pricing System

### CRITICAL BUSINESS RULES

#### Rule 1: Single Discount Only
**Users can NEVER combine discounts.** They receive the GREATER of:
1. **Upgrade Credit** - From previous purchase within 24 hours
2. **Promo Code** - Percentage discount from code

```typescript
// Decision logic (from create-checkout)
if (upgradeCredit >= promoDiscountAmount) {
  // Use upgrade credit, IGNORE promo code
  appliedDiscount = upgradeCredit;
  discountType = 'upgrade';
} else {
  // Use promo code, IGNORE upgrade credit
  appliedDiscount = promoDiscountAmount;
  discountType = 'promo';
}
```

#### Rule 2: 24-Hour Upgrade Window
```typescript
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

// Query for recent purchases
const { data: recentSessions } = await supabase
  .from("optimizer_sessions")
  .select("*")
  .eq("email", email)
  .eq("status", "active")  // Only completed purchases
  .gte("created_at", twentyFourHoursAgo)
  .order("created_at", { ascending: false });
```

#### Rule 3: Tier-Based Upgrades Only
Upgrade credit ONLY applies when moving to a HIGHER tier:
```typescript
const TIER_ORDER = ["basic", "standard", "premium", "pro"];

// Only credit if upgrading
if (previousTierIndex < currentTierIndex) {
  upgradeCredit = previousSessionPrice;
}
```

### Product Configuration Pattern
```typescript
// src/config/stripe.ts
export const STRIPE_PRICES = {
  basic_optimization: {
    price_id: "price_xxx",
    product_id: "prod_xxx",
    amount: 999,  // $9.99 in cents
    name: "Basic Optimization",
  },
  standard_optimization: {
    price_id: "price_xxx",
    product_id: "prod_xxx", 
    amount: 2499,  // $24.99
    name: "Standard Optimization",
  },
  premium_optimization: {
    price_id: "price_xxx",
    product_id: "prod_xxx",
    amount: 4999,  // $49.99
    name: "Premium Optimization",
  },
  pro: {
    price_id: "price_xxx",
    product_id: "prod_xxx",
    amount: 7900,  // $79/month
    name: "Pro Subscription",
    recurring: true,
  },
} as const;
```

### Session Config Pattern
```typescript
// src/types/session.ts
export interface SessionConfig {
  type: SessionType;
  name: string;
  price: string;
  priceInCents: number;
  description: string;
  icon: string;
  features: string[];
  badgeVariant: 'basic' | 'standard' | 'premium' | 'pro';
}
```

---

## 4. Stripe Integration

### Checkout Session Creation
```typescript
// Key checkout options
const checkoutOptions: Stripe.Checkout.SessionCreateParams = {
  customer: customerId,
  customer_email: customerId ? undefined : email,
  line_items: [{
    price: priceId,  // ALWAYS use price_id, never price_data
    quantity: 1,
  }],
  mode: isSubscription ? "subscription" : "payment",
  ui_mode: "hosted",
  success_url: `${origin}/success?session_type=${session_type}&email=${encodeURIComponent(email)}&checkout_session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/?canceled=true`,
  metadata: {
    session_id: dbSessionId,
    session_type,
    discount_type: discountType,
    upgraded_from_session: upgradedSessionId,
    discount_applied: appliedDiscount.toString(),
    discount_code_id: discountCodeId,
  },
};
```

### Dynamic Coupon Creation for Discounts
```typescript
// Create one-time coupon for the discount
if (appliedDiscount > 0 && !isSubscription) {
  const coupon = await stripe.coupons.create({
    amount_off: appliedDiscount,  // In cents
    currency: "usd",
    duration: "once",
    name: discountType === 'upgrade'
      ? `Upgrade credit from ${previousProduct}`
      : `Promo discount (${discountPercent}% off)`,
    max_redemptions: 1,
  });
  
  checkoutOptions.discounts = [{ coupon: coupon.id }];
}
```

### Stripe API Version
```typescript
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"), {
  apiVersion: "2025-08-27.basil",  // Use this exact version
});
```

---

## 5. Edge Function Patterns

### Required CORS Headers
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Always handle OPTIONS
if (req.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}
```

### Logging Pattern
```typescript
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FUNCTION-NAME] ${step}${detailsStr}`);
};
```

### Supabase Client Initialization
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);
```

### Required Edge Functions

#### 1. `validate-discount`
Validates promo codes with these checks:
- Code exists and is active
- Within valid date range
- Applies to the requested product
- User hasn't already used it
- Max uses not exceeded

```typescript
interface ValidateRequest {
  code: string;
  email: string;
  session_type: string;
}

interface ValidateResponse {
  valid: boolean;
  discount_percent?: number;
  description?: string;
  code_id?: string;
  error?: string;
}
```

#### 2. `create-checkout`
Creates Stripe checkout with:
- Upgrade credit calculation (24hr window)
- Promo discount calculation
- Single discount selection (greater wins)
- Pending session creation in DB
- Discount usage recording

#### 3. `verify-payment`
Verifies completed payment and:
- Updates session status to 'active'
- Sends confirmation email
- Returns session details

---

## 6. Admin Dashboard Integration

### Shared Admin Layout Pattern
```typescript
// Use existing AdminLayout and AdminSidebar components
import AdminLayout from '@/components/admin/AdminLayout';

export default function AdminOptimizerSessions() {
  return (
    <AdminLayout>
      {/* Your content */}
    </AdminLayout>
  );
}
```

### Discount Codes Table Structure
The `discount_codes` table includes:
```typescript
interface DiscountCode {
  id: string;
  code: string;  // Stored UPPERCASE
  description: string | null;
  discount_percent: number;
  applicable_products: string[] | null;  // Array of product IDs
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  is_active: boolean;
  created_at: string;
}
```

### Adding Resume Optimizer Products
Update the PRODUCTS constant in AdminDiscounts:
```typescript
const PRODUCTS = [
  // Existing Interview Coach products
  { id: 'quick_prep', name: 'Quick Prep ($12)' },
  { id: 'full_mock', name: 'Full Mock ($29)' },
  { id: 'premium_audio', name: 'Premium Audio ($49)' },
  { id: 'pro', name: 'Pro Subscription ($79/mo)' },
  // Resume Optimizer products
  { id: 'basic_optimization', name: 'Basic Optimization ($XX)' },
  { id: 'standard_optimization', name: 'Standard Optimization ($XX)' },
  { id: 'premium_optimization', name: 'Premium Optimization ($XX)' },
];
```

---

## 7. Component Patterns

### Checkout Dialog Props Interface
```typescript
interface CheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedConfig: SessionConfig | null;
  email: string;
  onEmailChange: (email: string) => void;
  promoCode: string;
  onPromoCodeChange: (code: string) => void;
  onApplyPromoCode: () => void;
  onRemovePromoCode: () => void;
  isValidatingPromo: boolean;
  promoError: string | null;
  pricing: PricingBreakdown | null;
  isCheckingUpgrade: boolean;
  isLoading: boolean;
  onCheckout: () => void;
}
```

### Pricing Breakdown Interface
```typescript
interface PricingBreakdown {
  originalPrice: number;      // In cents
  upgradeCredit: number;      // In cents (0 if none)
  discountAmount: number;     // In cents (0 if none)
  discountPercent: number;    // Percentage (0 if none)
  discountCode?: string;      // Code string if applied
  discountCodeId?: string;    // UUID if applied
  finalPrice: number;         // In cents
}
```

### Price Formatting
```typescript
const formatPrice = (cents: number) => {
  return `$${(cents / 100).toFixed(2)}`;
};
```

### Promo Code UX Pattern
1. Collapsible promo code section
2. Auto-uppercase input
3. Show applied state with remove option
4. Display error messages inline
5. Disable input while validating

---

## 8. Security Requirements

### RLS Policy Checklist
- [ ] Enable RLS on ALL tables with user data
- [ ] Always check `auth.uid() IS NOT NULL` before comparing
- [ ] Admin policies use `has_role(auth.uid(), 'admin'::app_role)`
- [ ] Service role policies for edge function operations
- [ ] No policies with plain `USING (true)` for SELECT

### Input Validation
- Normalize email: `email.toLowerCase().trim()`
- Normalize promo codes: `code.toUpperCase().trim()`
- Use case-insensitive matching: `.ilike()` for strings

### Session Status Flow
```
pending → active → completed
    ↓
  cancelled
```

### Environment Variables Required
```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
STRIPE_SECRET_KEY
RESEND_API_KEY  # For emails
```

---

## Quick Reference: Discount Flow Summary

```
User enters email
       ↓
Check for upgrade credit (24hr purchases at lower tier)
       ↓
User optionally enters promo code → Validate via edge function
       ↓
Compare: upgradeCredit vs promoDiscount
       ↓
USE THE GREATER ONE ONLY (never combine)
       ↓
Create one-time Stripe coupon with winning amount
       ↓
Record discount_code_usage ONLY if promo won
       ↓
Create checkout session with coupon attached
       ↓
Redirect to Stripe hosted checkout
```

---

## Contact & Questions

For any questions about implementation details, refer to the Interview Coach codebase or contact the development team.

**Key Files for Reference:**
- `supabase/functions/create-checkout/index.ts` - Checkout flow
- `supabase/functions/validate-discount/index.ts` - Promo validation
- `src/components/CheckoutDialog.tsx` - Checkout UI
- `src/pages/admin/AdminDiscounts.tsx` - Admin discount management
- `src/config/stripe.ts` - Price configuration
- `src/types/session.ts` - Type definitions
- `src/index.css` - Design system tokens
- `tailwind.config.ts` - Tailwind configuration
