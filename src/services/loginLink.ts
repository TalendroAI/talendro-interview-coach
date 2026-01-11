import { supabase } from "@/integrations/supabase/client";

export async function sendLoginLink(email: string, redirectTo?: string) {
  const { data, error } = await supabase.functions.invoke("send-login-link", {
    body: {
      email,
      redirectTo,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}
