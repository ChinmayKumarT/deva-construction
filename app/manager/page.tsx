import { redirect } from "next/navigation";

export default function ManagerLanding() {
  // Manager uses the same UI as admin (same permissions via RLS).
  redirect("/admin");
}
