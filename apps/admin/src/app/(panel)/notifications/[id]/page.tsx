import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { CampaignEditor } from '@/features/notifications';
import { getCampaign } from '@/features/notifications/server';

export const metadata: Metadata = { title: 'کمپین اعلان' };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  // Read access opens it; editing and sending are hidden without their permissions, and refused by the API.
  await requireAdminPermission('notifications.read');
  const { id } = await params;
  const campaign = await getCampaign(id);
  return <CampaignEditor key={campaign.id} initial={campaign} />;
}
