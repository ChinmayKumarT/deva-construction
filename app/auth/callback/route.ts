import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Both Google OAuth (signInWithGoogle) and the password-recovery email link
// (requestPasswordReset) land here with a ?code= to exchange for a session
// (PKCE code exchange) -- this is the redirectTo/next target we configured
// in each of those, not the redirect URI registered with Google itself
// (that one points at Supabase's own /auth/v1/callback).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Recovery links carry `next` so they land on the set-new-password
      // page instead of the role dashboard.
      if (next) return NextResponse.redirect(`${origin}${next}`);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, role_pending")
          .eq("id", user.id)
          .single();
        // Google OAuth carries no role metadata, so handle_new_user() marks
        // a fresh signup role_pending until they pick client vs. supplier.
        if (profile?.role_pending) return NextResponse.redirect(`${origin}/choose-role`);
        const role = profile?.role ?? "client";
        return NextResponse.redirect(`${origin}${role === "manager" ? "/admin" : `/${role}`}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/?error=${encodeURIComponent("Sign-in failed")}`);
}
