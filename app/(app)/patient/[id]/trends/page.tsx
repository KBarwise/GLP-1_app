import { redirect } from 'next/navigation';

/** Legacy trends URL — opens the overlay on the doctor consult workspace. */
export default function PatientTrendsRedirect({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { section?: string; tab?: string };
}) {
  const q = new URLSearchParams();
  const section = searchParams.section?.trim();
  const tab = searchParams.tab?.trim();
  if (section) q.set('trends', section);
  else if (tab) q.set('trends', tab === 'laboratory' ? 'laboratory-trends' : 'vitals-signs-trends');
  const query = q.toString();
  redirect(`/patient/${params.id}/consult/document${query ? `?${query}` : ''}`);
}
