/**
 * Outbound adapters: SMS gateways, payment providers, object storage, push
 * services — anything this API calls that it does not own.
 *
 * Each integration exposes an interface plus one implementation, so a service
 * depends on the capability rather than the vendor and a provider can be
 * swapped without the service changing. Same rule as the repositories in
 * `shared/repository.ts`.
 *
 * Nothing is wired up yet.
 */

export {};
