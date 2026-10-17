/**
 * Whether the user `u` is in the audience held in `audience` — a column or a
 * bound `jsonb` parameter, in the `ActivityAudience` shape. Interest
 * categories are matched on the person's stage-1 picks.
 *
 * Engagement Studio's activities and restricted events share it, so «who is
 * in this audience» has one answer in SQL. The caller's query must have the
 * person as `u` (a `v2_users` row).
 */
export const audienceMatch = (audience: string) => `(
     ${audience}->>'kind' = 'all'
  OR (${audience}->>'kind' = 'users' AND ${audience}->'phones' ? u.phone)
  OR (${audience}->>'kind' = 'interests' AND EXISTS (
        SELECT 1 FROM v2_user_interests i
         WHERE i.user_id = u.id AND ${audience}->'categoryIds' ? i.category_id)))`;
