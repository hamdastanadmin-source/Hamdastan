/**
 * Missions — ماموریت‌ها
 *
 * Public surface of the module. Nothing outside reaches past this file.
 *
 * The catalog is `MISSIONS` in `@hamdastan/config`; a mission's status is
 * read off the XP ledger in the Progress module, and a badge (`BADGES`) off
 * the missions, so this module has no storage of its own yet.
 */

export { missionsRoutes } from './missions.routes';
export { badgesFor, missionsService, missionsFor } from './missions.service';
export { setMissionsRepository, type MissionsRepository } from './missions.repository';
