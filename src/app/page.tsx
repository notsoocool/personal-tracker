import { redirect } from "next/navigation";
import { isOwnerAuthenticated } from "@/lib/auth";

export default async function HomePage() {
  if (await isOwnerAuthenticated()) {
    redirect("/cockpit");
  }
  redirect("/login");
}
