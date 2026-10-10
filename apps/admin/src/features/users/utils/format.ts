import type { AdminUser } from '@hamdastan/types';

export { formatDateTime } from '@/lib';

export function fullName(user: Pick<AdminUser, 'firstName' | 'lastName'>): string {
  return `${user.firstName} ${user.lastName}`;
}
