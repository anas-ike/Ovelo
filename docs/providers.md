# Provider configuration

## Local storage

For the current Pterodactyl deployment, use:

```dotenv
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=/home/container/storage
```

The local provider is behind the same `StorageProvider` and `StorageManager` interfaces as the remote providers. It creates the directory with restricted permissions, generates random storage keys, rejects traversal/absolute keys, and stores files outside the frontend build. Upload validation and quota enforcement happen before the provider is called. Keep the configured path on persistent container storage and do not expose it through Nginx.

## SMTP

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `SMTP_FROM_NAME`. Use port 587 with STARTTLS (`SMTP_SECURE=false`) or the provider's documented implicit TLS port. Verify registration, email verification, login notification, and password-reset delivery before production launch.

Credentials are read only by the API and worker. They are never returned in an API response or written to logs.

## Google Drive

1. Create a Google Cloud project and enable the Drive API.
2. Create a server-side OAuth client and configure `GOOGLE_DRIVE_REDIRECT_URI`.
3. Authorize the storage account for Drive access and obtain a refresh token.
4. Set `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, and an optional `GOOGLE_DRIVE_ROOT_FOLDER_ID`.

All Drive operations run in the API. The application stores a provider-independent `StorageObject` identity, checksum, size, and metadata. A Drive URL is never used as the permanent file identity.

## Bunny

Set `BUNNY_ENABLED=true`, `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_API_KEY`, and `BUNNY_CDN_URL` after creating a private storage zone. Bunny is behind the same `StorageProvider` interface and can be enabled for new uploads or migration without changing inventory models or UI.
