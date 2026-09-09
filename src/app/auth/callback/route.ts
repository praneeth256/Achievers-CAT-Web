import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/daily";

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    const user = data.user;
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        display_name: user.user_metadata.full_name || user.user_metadata.name || "",
        email: user.email || "",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    }
  }

  return NextResponse.redirect(new URL(destination, url.origin));
}
