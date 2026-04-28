declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_AUTH0_DOMAIN?: string;
    EXPO_PUBLIC_AUTH0_CLIENT_ID?: string;
    EXPO_PUBLIC_AUTH0_AUDIENCE?: string;
    EXPO_PUBLIC_API_BASE_URL?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
