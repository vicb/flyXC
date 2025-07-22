export declare class HttpError extends Error {
  status: number;
  message: string;
  responseText?: string;
  constructor(status: number, message: string, responseText?: string);
}
