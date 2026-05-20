"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/lib/insome/i18n";

export async function setLocaleAction(next: string) {
  if (!isLocale(next)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
