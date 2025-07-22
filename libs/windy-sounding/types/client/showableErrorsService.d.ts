import type { ErrorCategory, ShowableError } from '@windy/types.d';
export declare const add: (_error: ShowableError) => void;
/**
 * Sets showableError to not be displayed anymore
 * @param errorId
 */
export declare const close: (_errorId: string) => void;
/**
 * It return array unresolvedErrors with removed showableError
 * @param errorId
 */
export declare const resolve: (_errorId: string) => void;
/**
 * It resolve whole category of errors from unresolvedErrors
 * @param category
 */
export declare const resolveCategory: (_category: ErrorCategory) => void;
/**
 * Returns unresolved errors
 * @returns ShowableError[]
 */
export declare const getUnresolvedErrors: () => any[];
/**
 * Control if error was resolved, based on category of the error
 * @param error
 */
export declare function checkError(_error: ShowableError): void;
