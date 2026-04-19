/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY: string
  readonly NEXT_PUBLIC_DRIVE_FOLDER_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
