// app/studio/page.tsx - retired Studio entry redirect
// License: Apache-2.0

import { redirect } from 'next/navigation';

export default function StudioPage() {
  redirect('/app/modules/concept_design');
}
