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

    const fromEmail = "Talendro <noreply@talendro.com>";

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
      subject: "Your Talendro Login Link",
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Your Talendro Login Link</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px;">Talendro</h1>
              <p style="margin: 8px 0 0; font-size: 14px; color: #64748b;">Interview Coaching</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #1e293b;">Access Your Dashboard</h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #475569;">
                Click the button below to securely log in to your Talendro account and access your interview coaching dashboard.
              </p>
              <!-- Button - using VML for Outlook compatibility -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${magicLink}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="17%" stroke="f" fillcolor="#0f172a">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">Open Dashboard</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${magicLink}" target="_blank" style="display: inline-block; mso-hide: all; padding: 14px 32px; background-color: #0f172a; color: #ffffff !important; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; text-align: center; line-height: 1.2;">
                      Open Dashboard
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; font-size: 14px; color: #64748b;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0; font-size: 12px; color: #0ea5e9; word-break: break-all;">
                <a href="${magicLink}" style="color: #0ea5e9; text-decoration: underline;">${magicLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8; text-align: center;">
                This link expires in 1 hour for security purposes.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
        <!-- Bottom text -->
        <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
          © ${new Date().getFullYear()} Talendro. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
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
