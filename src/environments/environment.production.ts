import { AppEnvironment } from './environment.interface';

export type { AppEnvironment };

export const environment: AppEnvironment = {
  production: true,
  cognito: {
    userPoolId: 'REPLACE_WITH_PROD_USER_POOL_ID',
    userPoolClientId: 'REPLACE_WITH_PROD_APP_CLIENT_ID',
    oauthDomain: 'auth.fintracker.dev',
    redirectSignIn: 'https://app.fintracker.dev/auth/callback',
    redirectSignOut: 'https://app.fintracker.dev/auth/login',
  },
  devUserId: '',
  devUserMap: {},
};
