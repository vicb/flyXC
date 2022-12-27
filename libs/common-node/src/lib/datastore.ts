import { Datastore, Key } from '@google-cloud/datastore';

// Get the numeric id of an entity from its key.
export function idFromEntity<T extends { [Datastore.KEY]: Key }>(entity: T): number {
  return Number(entity[Datastore.KEY].id);
}
