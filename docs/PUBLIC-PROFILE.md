# Public profile

Live Profile includes a public nickname (2–60 characters, no @ or control characters) and an optional public HTTPS avatar URL. GET/POST `/user/profile` require account or TMA authentication and act only on the authenticated user; the POST body cannot select a user ID or change login fields. Responses contain only id, nickname and avatar_url. Blank avatar removes the custom image and prevents legacy profile fallback from restoring it.

Login presentation no longer falls back to account display_name/user_name. Telegram public names can be used, but names containing @ are not displayed. Unset account nicknames use `Player #<business user ID>`, never an email prefix. Rankings already use a bounded projection excluding login identifiers, wallets and referral information; edits become visible after the next cached ranking refresh. KOL review identity and team names remain separate.

Nickname uniqueness is not guaranteed and does not establish verification. User IDs remain the identity keys. Users must not put private information in avatar URLs, team descriptions or KOL submissions; this change does not automatically moderate arbitrary user-authored content. External image hosts may receive visitor network metadata. Image uploads/proxying and a private account-settings screen are outside this change.

Restart the Go server after deploying the new routes. Existing login/account collections and credentials are unchanged; no data migration is required.
