import { redirect } from "next/navigation";

/**
 * Admin home — there is no separate landing screen yet, so we send the
 * admin straight into the users roster, which is the primary admin tool.
 */
export default function AdminHome() {
  redirect("/admin/users");
}
