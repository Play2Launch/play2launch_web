# Live leaderboard

`/campaign/:slug/leaderboard` displays the campaign artwork, players/teams tabs, top-three cards and the full returned top-100 table. `/leaderboard` currently opens PAPERHOOD, not a cross-campaign aggregate. Scores come only from the existing server rankings endpoint; no demo scores are mixed in.

Refresh runs every 10 seconds while the page is visible, also on window focus and manually. Requests do not overlap. Route changes abort outstanding requests. A failed refresh preserves the last valid snapshot and displays an error; the timestamp is the server snapshot's as_of (Redis cache can add 2 seconds).

Switch campaign opens the shared searchable, paginated picker using the public catalog's `q` parameter (literal name/ticker/slug search, max 80 characters). Closed campaigns remain selectable. Changing campaign resets and aborts the old leaderboard requests.

Rankings include bounded public profile fields: nickname, or Telegram public display name, and HTTPS avatar. Account login-derived display names, usernames, emails, wallets and referral fields are not published. Missing names use an anonymous Player label; missing/broken avatars use initials. Personal best team is score provenance, not necessarily current membership. Current team rank is selected from the authenticated membership. Outside the returned list, the UI explicitly says either no ranked score or outside the top 100; it never invents an exact rank.

Production visual layout does not change campaign/test-reward policy. The existing test-activity disclaimer remains. Tests cover score validation, own standings, team switching, retaining snapshots on error and visibility refresh.
