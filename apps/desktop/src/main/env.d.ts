/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  /** Base URL of the PBS Attend server API (admin app), e.g. https://attend.example.com */
  readonly MAIN_VITE_PBS_ATTEND_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
