import { createRepositorySlot } from '../../shared/repository';

/**
 * Data access port for the Events module.
 *
 * Declare one method per read or write eventsService needs, named in the
 * language of the domain (`findActiveByWorld`) rather than of a store
 * (`query`, `execute`). Keeping the vocabulary domain-shaped is what makes
 * the port outlive whichever database is eventually chosen.
 *
 * No implementation exists yet — see `shared/repository.ts`.
 */
export interface EventsRepository {
  // Declare this module's reads and writes here.
}

const slot = createRepositorySlot<EventsRepository>('events');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const eventsRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setEventsRepository = slot.set;
