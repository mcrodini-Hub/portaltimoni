import { auth } from "@/lib/auth";
import ReunioesClient from "./reunioes-client";

const GESTAO_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);
const ADMIN_EMAIL = "mcrodini@gmail.com";

export default async function ReunioesPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() || "";
  return (
    <div className="pb-10">
      <ReunioesClient
        isGestao={GESTAO_EMAILS.has(email)}
        canManage={email === ADMIN_EMAIL}
      />
    </div>
  );
}
