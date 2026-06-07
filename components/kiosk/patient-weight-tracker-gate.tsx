'use client';

import { useRouter } from 'next/navigation';
import { PatientWeightTracker } from '@/components/kiosk/patient-weight-tracker';

export function PatientWeightTrackerGate() {
  const router = useRouter();
  return <PatientWeightTracker onBack={() => router.push('/kiosk')} />;
}
