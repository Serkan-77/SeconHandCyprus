import { redirect } from "next/navigation";

// Admins sign in like everyone else; the admin area checks the role.
export default function AdminLogin() {
  redirect("/giris?returnTo=/yonetim");
}
