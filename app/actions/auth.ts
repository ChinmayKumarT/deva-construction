"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Role = "admin" | "manager" | "client" | "supplier" | "labour";

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
