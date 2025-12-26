import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, email, session_type }: ValidateRequest = await req.json();

    if (!code || !email || !session_type) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Normalize code to uppercase for case-insensitive matching
    const normalizedCode = code.toUpperCase().trim();

    console.log(`[VALIDATE-DISCOUNT] Checking code: ${normalizedCode} for email: ${email}, product: ${session_type}`);

    // Find the discount code
    const { data: discountCode, error: codeError } = await supabaseAdmin
      .from("discount_codes")
      .select("*")
      .ilike("code", normalizedCode)
      .eq("is_active", true)
      .single();

    if (codeError || !discountCode) {
      console.log(`[VALIDATE-DISCOUNT] Code not found or inactive: ${normalizedCode}`);
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid promo code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check if code is within valid date range
    const now = new Date();
    if (discountCode.valid_from && new Date(discountCode.valid_from) > now) {
      console.log(`[VALIDATE-DISCOUNT] Code not yet valid: ${normalizedCode}`);
      return new Response(
        JSON.stringify({ valid: false, error: "This promo code is not yet active" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (discountCode.valid_until && new Date(discountCode.valid_until) < now) {
      console.log(`[VALIDATE-DISCOUNT] Code expired: ${normalizedCode}`);
      return new Response(
        JSON.stringify({ valid: false, error: "This promo code has expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check if code applies to this product
    if (discountCode.applicable_products && !discountCode.applicable_products.includes(session_type)) {
      console.log(`[VALIDATE-DISCOUNT] Code not applicable to ${session_type}: ${normalizedCode}`);
      return new Response(
        JSON.stringify({ valid: false, error: "This promo code doesn't apply to this product" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check if this email has already used this code
    const { data: existingUsage, error: usageError } = await supabaseAdmin
      .from("discount_code_usage")
      .select("id")
      .eq("code_id", discountCode.id)
      .ilike("email", email.trim())
      .maybeSingle();

    if (existingUsage) {
      console.log(`[VALIDATE-DISCOUNT] Code already used by ${email}: ${normalizedCode}`);
      return new Response(
        JSON.stringify({ valid: false, error: "You've already used this promo code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check max uses if specified
    if (discountCode.max_uses) {
      const { count } = await supabaseAdmin
        .from("discount_code_usage")
        .select("*", { count: "exact", head: true })
        .eq("code_id", discountCode.id);

      if (count && count >= discountCode.max_uses) {
        console.log(`[VALIDATE-DISCOUNT] Code max uses reached: ${normalizedCode}`);
        return new Response(
          JSON.stringify({ valid: false, error: "This promo code has reached its maximum uses" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    // Code is valid!
    console.log(`[VALIDATE-DISCOUNT] Code valid! ${discountCode.discount_percent}% off for ${email}`);
    
    const response: ValidateResponse = {
      valid: true,
      discount_percent: discountCode.discount_percent,
      description: discountCode.description,
      code_id: discountCode.id,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[VALIDATE-DISCOUNT] Error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "An error occurred validating the code" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
