// Formats request-zero errors.
export function formatReqError(error: any): string {
  if (error === undefined) {
    return 'undefined';
  }
  if (error != null) {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'object') {
      switch (error.code) {
        case 'ECONNRESET':
        case 'ETIMEDOUT':
        case 401: // Unauthorized
        case 503: // Unavailable
          return `${error.code} (${error.message ?? ''})`;
        case 404:
          return '404';
        case 500:
          return `500 (Internal server error)`;
      }
    }
  }

  return JSON.stringify(error).replace(/\"/gi, '');
}
