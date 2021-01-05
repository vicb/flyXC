import { Request } from 'express';

// Interface for session.grant.response.
export interface GrantSession {
  access_token?: string;
  // The profile should only be accessed when the access token is defined.
  profile: {
    name: string;
    email: string;
    sub: string;
  };
}

export function getGrantSession(req: Request): GrantSession | undefined {
  const session = req.session as any;
  return session?.grant?.response;
}
