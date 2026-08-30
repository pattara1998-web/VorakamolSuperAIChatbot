<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Vorakamol SuperAI v2.8

## Build and deploy

Run `npm run build`. The deploy-ready frontend and server are created in `dist`.

For live Facebook Messenger, set these server environment variables on the host (never in the browser):

- `META_APP_ID` and `META_APP_SECRET`
- `META_REDIRECT_URI=https://<your-domain>/api/facebook/callback`
- `FACEBOOK_VERIFY_TOKEN` (use the same value in Meta Webhooks)
- `ENCRYPTION_SECRET_KEY` (a long random secret)
- `DATA_FILE` pointing to mounted durable storage, or replace the local store with your production database

In Meta Developers, add `https://<your-domain>/api/facebook/callback` as a valid OAuth redirect URI and `https://<your-domain>/api/webhook/facebook` as the Messenger webhook callback. Request/obtain approval for the Messenger and Page permissions used by your business before serving people outside app roles.

After this one-time server setup, users connect pages with the **Continue with Facebook** button; they do not enter a Page ID or access token. The system securely exchanges and stores the Page token, subscribes the Page webhook, and uses it for chat/comment automation.
