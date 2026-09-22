import type { v2_UserRole } from '@prisma/client';

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  role: v2_UserRole;
  isActive: boolean;
};
