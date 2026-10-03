'use client';

import { useState } from 'react';
import { AtSign, FileText, MapPin, Shirt, UserRound } from 'lucide-react';

import type { AccountProfile } from '@hamdastan/types';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';

import { FieldSheet, type ProfileField } from './FieldSheet';
import { ListGroup, ListRow } from './ListGroup';

/**
 * «ویرایش پروفایل» — the profile as a short list of what it holds, each row
 * opening its own sheet. Required and optional are separate groups, and the
 * optional one says so.
 *
 * Only the fields the product uses. Name, birth date and gender were given
 * at sign-up and are not edited here.
 */
export function EditProfile({ profile }: { profile: AccountProfile }) {
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
        </ListGroup>

        <ListGroup title="درباره من · اختیاری">
          <ListRow icon={FileText} label="بیو" value={profile.bio ?? empty} onClick={() => setEditing('bio')} />
        </ListGroup>

        <ListGroup title="ظاهر">
          <ListRow icon={Shirt} label="آواتار" href="/profile/avatar" />
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
