import {
  MOCK_CATALOG,
  MOCK_ITEMS,
  MOCK_NOTIFICATIONS,
  MOCK_POS,
  MOCK_ROLES,
  MOCK_SITES,
  MOCK_SNAPSHOTS,
  MOCK_SUPPLIERS,
  MOCK_USERS,
  MOCK_WORKFLOW_STEPS,
} from './mockData';
import { PORequest } from '../types';

export const getDevelopmentFixtures = () => {
  const pos = MOCK_POS.map((po, idx) => {
    const fallbackSite = MOCK_SITES[idx % MOCK_SITES.length];
    const labelledSite = (po as unknown as { site?: string }).site || '';
    const matchedSite = MOCK_SITES.find(site =>
      labelledSite.toLowerCase().includes(site.name.toLowerCase()) ||
      labelledSite.toLowerCase().includes(site.suburb.toLowerCase())
    );
    const siteId = (po as unknown as { siteId?: string }).siteId || matchedSite?.id || fallbackSite.id;
    const site = labelledSite || matchedSite?.name || fallbackSite.name;
    return {
      ...po,
      siteId,
      site,
    };
  }) as PORequest[];

  const adminUser = {
    ...(MOCK_USERS.find(user => user.role === 'ADMIN') || MOCK_USERS[0]),
    realRole: 'ADMIN' as const,
    status: 'APPROVED' as const,
    siteIds: MOCK_SITES.map(site => site.id),
  };

  return {
    users: MOCK_USERS,
    roles: MOCK_ROLES,
    sites: MOCK_SITES,
    suppliers: MOCK_SUPPLIERS,
    items: MOCK_ITEMS,
    catalog: MOCK_CATALOG,
    stockSnapshots: MOCK_SNAPSHOTS,
    pos,
    workflowSteps: MOCK_WORKFLOW_STEPS,
    notificationRules: MOCK_NOTIFICATIONS,
    adminUser,
  };
};

export type DevelopmentFixtures = ReturnType<typeof getDevelopmentFixtures>;
