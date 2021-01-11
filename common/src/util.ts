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
          return `${error.code} (${error.message ?? ''})`;
        case 404:
          return '404';
      }
    }
  }

  return JSON.stringify(error).replace(/\"/gi, '');
}
