import { AppEnvironment } from './environment.interface';

export type { AppEnvironment };

// Default export is the DEVELOPMENT configuration.
// angular.json replaces this file with environment.production.ts for production builds.
export const environment: AppEnvironment = {
  production: false,
  cognito: {
    userPoolId: 'us-east-1_XwKqA7fDT',
    userPoolClientId: '6vua2jh8u2rp5bhk4rcpvieqvo',
    oauthDomain: 'https://us-east-1xwkqa7fdt.auth.us-east-1.amazoncognito.com',
    redirectSignIn: 'http://localhost:4200/auth/callback',
    redirectSignOut: 'http://localhost:4200/auth/login',
  },
  devUserId: 'e2b86a8a-b851-460d-8ea9-a1b66df8ae8e',
};
