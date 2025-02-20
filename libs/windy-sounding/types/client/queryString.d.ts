export type ParsedQueryString = Record<string, string | undefined>;
export declare function parseQueryString(searchQuery: string | undefined): ParsedQueryString | undefined;
