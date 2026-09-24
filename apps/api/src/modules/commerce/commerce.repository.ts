import { createRepositorySlot } from '../../shared/repository';

/**
 * Data access port for the Commerce module.
 *
 * Declare one method per read or write commerceService needs, named in the
 * language of the domain (`findActiveByWorld`) rather than of a store
 * (`query`, `execute`). Keeping the vocabulary domain-shaped is what makes
 * the port outlive whichever database is eventually chosen.
 *
 * No implementation exists yet — see `shared/repository.ts`.
 */
export interface CommerceRepository {
  // Declare this module's reads and writes here.
}

const slot = createRepositorySlot<CommerceRepository>('commerce');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const commerceRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setCommerceRepository = slot.set;
