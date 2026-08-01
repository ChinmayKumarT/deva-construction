"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Role = "admin" | "manager" | "client" | "supplier" | "labour";

// No hardcoded site-URL env var -- derive it from the incoming request so
// this works the same on localhost and whatever domain Vercel deploys to,
// without needing a new env var kept in sync per environment.
function siteOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/?error=${encodeURIComponent(error.message)}`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?error=missing-session");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role ?? "client") as Role;
  // Manager shares admin's UI.
  redirect(role === "manager" ? "/admin" : `/${role}`);
}

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteOrigin()}/auth/callback` },
  });
  if (error) redirect(`/?mode=magic-link&error=${encodeURIComponent(error.message)}`);
  redirect(
    `/?mode=magic-link&notice=${encodeURIComponent("Check your email for a sign-in link.")}`,
  );
}

export async function signInWithGoogle() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteOrigin()}/auth/callback` },
  });
  if (error || !data.url) {
    redirect(`/?error=${encodeURIComponent(error?.message ?? "Google sign-in failed")}`);
  }
  redirect(data.url);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const supabase = createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteOrigin()}/auth/callback?next=/reset-password`,
  });
  // Same message whether or not the email has an account -- resetPasswordForEmail
  // doesn't report that either, so this doesn't let someone probe for registered emails.
  redirect(
    `/forgot-password?notice=${encodeURIComponent("If that email has an account, a reset link is on its way.")}`,
  );
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) {
    redirect(`/reset-password?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }
  if (password !== confirm) {
    redirect(`/reset-password?error=${encodeURIComponent("Passwords don't match.")}`);
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);

  // Sign out rather than dropping them straight into their dashboard --
  // "reset done, now sign in with it" is a clearer end state than silently
  // continuing a session that started from an email link.
  await supabase.auth.signOut();
  redirect(`/?notice=${encodeURIComponent("Password updated. Sign in with your new password.")}`);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");
  const role = String(formData.get("role") ?? "client") as Role;
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  });
  if (error) redirect(`/?error=${encodeURIComponent(error.message)}`);
  redirect(`/?notice=${encodeURIComponent("Check your email to confirm, then sign in.")}`);
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteAccount() {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) redirect(`/?error=${encodeURIComponent(error.message)}`);
  await supabase.auth.signOut();
  redirect("/?notice=Account+deleted");
}
