import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DASHBOARD_URL = "https://coach.talendro.com/dashboard";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-LOGIN-LINK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json().catch(() => ({ email: null }));

    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing backend environment variables");
    }

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const fromEmail = Deno.env.get("RESEND_FROM") ?? "Talendro <onboarding@resend.dev>";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    logStep("Ensuring auth account", { email });

    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    const existingUser = existingUsers?.users?.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );

    if (!existingUser) {
      const { error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      logStep("Auth user created", { email });
    } else {
      logStep("Auth user exists", { email, userId: existingUser.id });
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: DASHBOARD_URL,
      },
    });

    if (linkError) {
      throw new Error(`Failed to generate link: ${linkError.message}`);
    }

    const magicLink = linkData?.properties?.action_link;
    if (!magicLink) {
      throw new Error("Magic link missing from generateLink response");
    }

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: "Your login link — Interview Coach",
      html: `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; color: #111827;">
          <h1 style="margin: 0 0 12px; font-size: 20px;">Your login link</h1>
          <p style="margin: 0 0 16px;">Click below to access your dashboard:</p>
          <p style="margin: 0 0 20px;">
            <a href="${magicLink}" style="display:inline-block; padding:12px 16px; background:#111827; color:#ffffff; text-decoration:none; border-radius:8px;">Open Dashboard</a>
          </p>
          <p style="margin: 0; font-size: 12px; color: #6b7280;">If you didn't request this email, you can ignore it.</p>
        </div>
      `,
    });

    const resendError = (emailResponse as any)?.error;
    if (resendError) {
      throw new Error(
        `Resend send failed: ${resendError?.message ?? JSON.stringify(resendError)}`,
      );
    }

    const emailId = (emailResponse as any)?.data?.id ?? (emailResponse as any)?.id ?? null;

    logStep("Email send attempted", { email, fromEmail, emailId });
    console.log("[SEND-LOGIN-LINK] Resend raw response", emailResponse);

    return new Response(JSON.stringify({ ok: true, id: emailId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error?.message ?? String(error) });
    return new Response(
      JSON.stringify({ error: error?.message ?? String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
