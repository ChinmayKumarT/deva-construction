"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function selfCheckIn(fd: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");

  const { data: labourer } = await supabase
    .from("labourers")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!labourer) throw new Error("no labourer profile linked to this account");

  const { data: assignment } = await supabase
    .from("project_labourers")
    .select("project_id")
    .eq("labourer_id", labourer.id)
    .is("unassigned_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const status = (String(fd.get("status") ?? "present")) as "present" | "absent" | "half_day";

  const { error } = await supabase
    .from("attendance")
    .upsert(
      {
        labourer_id: labourer.id,
        project_id: assignment?.project_id ?? null,
        date: today,
        status,
        check_in: status === "absent" ? null : new Date().toISOString(),
      },
      { onConflict: "labourer_id,date" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/labour");
}
