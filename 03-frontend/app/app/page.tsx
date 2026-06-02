// app/app/page.tsx - ArchIToken app root entry
// License: Apache-2.0

import { redirect } from "next/navigation";

export default function AppRootPage() {
  redirect("/app/modules/personal_center");
}
