import { AppEnvironment } from './environment.interface';

export type { AppEnvironment };

// Default export is the DEVELOPMENT configuration.
// angular.json replaces this file with environment.production.ts for production builds.
export const environment: AppEnvironment = {
  production: false,
  cognito: {
    userPoolId: 'us-east-1_XwKqA7fDT',
    userPoolClientId: '6vua2jh8u2rp5bhk4rcpvieqvo',
    oauthDomain: 'us-east-1xwkqa7fdt.auth.us-east-1.amazoncognito.com',
    redirectSignIn: 'http://localhost:4200/auth/callback',
    redirectSignOut: 'http://localhost:4200/auth/login',
  },
  // Default/fallback local user — matches the seeded Postgres data created by dev_seed_data.sql.
  devUserId: 'e2b86a8a-b851-460d-8ea9-a1b66df8ae8e',
  // Second local user for testing tenant isolation. Register a real second Cognito
  // account via the Hosted UI, run `dev_setup_user.py --sub <sub> --email <email>
  // --generate-user-id` to create its DynamoDB identity + get back its UUID, seed
  // separate Postgres data for that UUID, then add the mapping here:
  //   '<second_cognito_sub>': '<uuid_dev_setup_user.py_printed>',
  devUserMap: {
    '544814a8-c031-7085-2913-eea65a395715': '30fc65d0-e278-4d40-8106-db8347b4fd06',
  },
};
