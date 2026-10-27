'use client';

import { useState } from 'react';
import { AtSign, FileText, Heart, Instagram, Linkedin, MapPin, Send, UserRound } from 'lucide-react';

import type { AccountProfile } from '@hamdastan/types';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';

import { FieldSheet, type ProfileField } from './FieldSheet';
import { ListGroup, ListRow } from './ListGroup';

const SOCIAL_ROWS = [
  { field: 'instagram', icon: Instagram, label: 'اینستاگرام' },
  { field: 'telegram', icon: Send, label: 'تلگرام' },
  { field: 'linkedin', icon: Linkedin, label: 'لینکدین' },
] as const;

/**
 * «ویرایش پروفایل» — the profile as a short list of what it holds, each row
 * opening its own sheet. Required and optional are separate groups, and the
 * optional one says so.
 *
 * Social links are handles, shown `dir="ltr"` with `@`; the API stores
 * the handle alone, never a URL.
 *
 * Only the fields the product uses. Name, birth date and gender were given
 * at sign-up and are not edited here.
 *
 * Interests are onboarding stage 1's picks; their row opens that picker as
 * its own screen (`/profile/edit/interests`) — too long for a sheet.
 */
export function EditProfile({ profile, interestCount }: { profile: AccountProfile; interestCount: number }) {
  const [editing, setEditing] = useState<ProfileField | null>(null);
  const empty = <span className="text-muted-foreground/70">اضافه کن</span>;

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/profile" />
      </ScreenHeader>

      <ScreenBody className="gap-8">
        <ScreenTitle title="ویرایش پروفایل" />

        <ListGroup title="اطلاعات اصلی">
          <ListRow icon={UserRound} label="نام" value={profile.displayName ?? empty} onClick={() => setEditing('displayName')} />
          <ListRow
            icon={AtSign}
            label="نام کاربری"
            value={profile.username ? <bdi dir="ltr">@{profile.username}</bdi> : empty}
            onClick={() => setEditing('username')}
          />
          <ListRow icon={MapPin} label="شهر" value={profile.city ?? empty} onClick={() => setEditing('city')} />
          <ListRow
            icon={Heart}
            label="علاقه‌مندی‌ها"
            value={interestCount > 0 ? `${toPersianDigits(interestCount)} انتخاب` : empty}
            href="/profile/edit/interests"
          />
        </ListGroup>

        <ListGroup title="درباره من · اختیاری">
          <ListRow icon={FileText} label="بیو" value={profile.bio ?? empty} onClick={() => setEditing('bio')} />
        </ListGroup>

        <ListGroup title="شبکه‌های اجتماعی · اختیاری">
          {SOCIAL_ROWS.map(({ field, icon, label }) => (
            <ListRow
              key={field}
              icon={icon}
              label={label}
              value={profile[field] ? <bdi dir="ltr">@{profile[field]}</bdi> : empty}
              onClick={() => setEditing(field)}
            />
          ))}
        </ListGroup>
      </ScreenBody>

      <FieldSheet
        field={editing}
        initialValue={editing ? (profile[editing] ?? '') : ''}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}
