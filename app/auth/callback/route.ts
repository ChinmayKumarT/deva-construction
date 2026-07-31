import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Supabase's Google OAuth flow lands here with a ?code= to exchange for a
// session (PKCE code exchange) -- this is the redirectTo target configured
// in signInWithGoogle, not the redirect URI registered with Google itself
// (that one points at Supabase's own /auth/v1/callback).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        const role = profile?.role ?? "client";
        return NextResponse.redirect(`${origin}${role === "manager" ? "/admin" : `/${role}`}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/?error=${encodeURIComponent("Google sign-in failed")}`);
}
