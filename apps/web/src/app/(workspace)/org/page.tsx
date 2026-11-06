import { redirect } from "next/navigation";

/** The organization area opens on its accounts (SCR-080); domains (SCR-081) come with the editor. */
export default function OrganizationPage() {
  redirect("/org/accounts");
}
