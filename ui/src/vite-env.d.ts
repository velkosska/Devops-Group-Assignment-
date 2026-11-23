/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPLICATIONS_API_URL?: string;
  readonly VITE_INSIGHTS_API_URL?: string;
}

declare module "@fontsource-variable/*";

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
