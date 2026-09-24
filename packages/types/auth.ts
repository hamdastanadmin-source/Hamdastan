export type UserRole = 'ADMIN' | 'ANALYST';

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
};
