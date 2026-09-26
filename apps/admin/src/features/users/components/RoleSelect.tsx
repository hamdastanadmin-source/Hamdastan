'use client';

import { ADMIN_ROLES } from '@hamdastan/shared/rbac';
import type { AdminRoleCode } from '@hamdastan/types';
import {
  FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hamdastan/ui';

/**
 * The role picker, filled from the shared catalogue.
 *
 * There is no endpoint for the list of roles: the catalogue in
 * `@hamdastan/shared/rbac` is what both sides read, so a role offered here is
 * by construction a role the backend will accept, and adding one shows up on
 * this screen without a change to it.
 */
export function RoleSelect({
  value,
  onChange,
  error,
}: {
  value: AdminRoleCode | '';
  onChange: (role: AdminRoleCode) => void;
  error?: string;
}) {
  return (
    <FormField label="نقش" required error={error}>
      <Select value={value || undefined} onValueChange={(next) => onChange(next as AdminRoleCode)}>
        <SelectTrigger aria-label="نقش">
          <SelectValue placeholder="انتخاب نقش" />
        </SelectTrigger>
        <SelectContent>
          {ADMIN_ROLES.map((role) => (
            <SelectItem key={role.code} value={role.code}>
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
