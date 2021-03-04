import { Request } from 'express';
import { SecretKeys } from 'flyxc/common/src/keys';

const adminEmails = SecretKeys.ADMINS.split(',');

declare module 'express-session' {
  interface SessionData {
    // Grant.
    grant: {
      response: {
        access_token?: string;
        profile: {
          name: string;
          email: string;
          sub: string;
        };
      };
    };

    // flyxc session.
    // name, email and token are defined if isLoggedIn === true.
    isLoggedIn: boolean;
    name: string;
    email: string;
    token: string;
  }
}

export async function logout(request: Request): Promise<void> {
  let done: () => void;
  const promise = new Promise<void>((resolve) => (done = resolve));
  request?.session.destroy(() => done());
  return promise;
}

export function isLoggedIn(request: Request): boolean {
  const session = request.session;

  if (session?.isLoggedIn === true) {
    return true;
  }

  if (session?.grant?.response?.access_token) {
    const profile = session.grant.response.profile;

    if (profile) {
      session.isLoggedIn = true;
      session.name = profile.name;
      session.email = profile.email;
      session.token = profile.sub;
    } else {
      console.log('login failure');
    }

    delete session.grant;
  }

  return session?.isLoggedIn === true;
}

export function isAdmin(request: Request): boolean {
  return isLoggedIn(request) && adminEmails.indexOf(request.session.email ?? '') > -1;
}

export function getUserInfo(request: Request): { name: string; email: string; token: string } | undefined {
  if (isLoggedIn(request)) {
    const { name, email, token } = request.session;
    return { name: name!, email: email!, token: token! };
  }

  return undefined;
}
