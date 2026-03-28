import { redirect } from "next/navigation";

// Redirect to agent directory with offices tab
export default function KancelareRedirect() {
  redirect("/makleri");
}
