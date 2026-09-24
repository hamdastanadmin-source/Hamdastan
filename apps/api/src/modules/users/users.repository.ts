import { createRepositorySlot } from '../../shared/repository';

/**
 * Data access port for the Users module.
 *
 * Declare one method per read or write usersService needs, named in the
 * language of the domain (`findActiveByWorld`) rather than of a store
 * (`query`, `execute`). Keeping the vocabulary domain-shaped is what makes
 * the port outlive whichever database is eventually chosen.
 *
 * No implementation exists yet — see `shared/repository.ts`.
 */
export interface UsersRepository {
  // Declare this module's reads and writes here.
}

const slot = createRepositorySlot<UsersRepository>('users');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const usersRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setUsersRepository = slot.set;
