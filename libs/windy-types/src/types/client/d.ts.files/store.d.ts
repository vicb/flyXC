import { Timestamp } from '@windy/types.d';
import { DataSpecifications } from '@windy/dataSpecifications.d';

/**
 * Stores which have `asyncSet` function defined
 */
export type AsyncStores = 'overlay' | 'product';

/**
 * Return type of `store.set` method. If `asyncSet` is defined, returned type is Promise<T>, boolean for sync stores.
 * See store.ts `set` method implementation for more info.
 */
export type SetReturnType<T extends keyof DataSpecifications> = T extends AsyncStores
    ? ReturnType<NonNullable<DataSpecifications[T]['asyncSet']>>
    : boolean;

/**
 * Optional options for setter
 */
export interface StoreOptions {
    /**
     * Identifier of UI element that emitted the change (is bounced back with evented message)
     */
    UIident?: string;

    /**
     * Skip validity check
     */
    doNotCheckValidity?: boolean;

    /**
     * Force change update time
     */
    update?: Timestamp;

    /**
     * Skip saving to cloud
     */
    doNotSaveToCloud?: boolean;

    /**
     * Do not store to localStorage
     */
    doNotStore?: boolean;

    /**
     * Force to change the value, even when is the same as previous
     */
    forceChange?: boolean;
}

type UIIdent = string | undefined;

type UnwrappedDataSpecifications = {
    [P in keyof DataSpecifications]: [DataSpecifications[P]['def'], UIIdent];
};

interface StoreTypes extends UnwrappedDataSpecifications {
    _cloudSync: [];
    _nativeSync: [string, unknown];
}
