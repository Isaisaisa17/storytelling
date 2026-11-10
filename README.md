# Storytelling

Mobile planning poker with live English and German interfaces, readable room names, and no accounts. React + TypeScript, Node.js + TypeScript, and WebSockets, served from one container.

## Run with Docker

```sh
docker compose up --build -d
docker compose ps
```

Open `http://localhost:3000`. Other devices on the same network can use `http://<server-ip>:3000`. Allow inbound traffic on port 3000 as needed. `PORT=8080 docker compose up --build -d` changes the exposed port. `BIND_ADDRESS=127.0.0.1` restricts it to local access for a reverse proxy.

```sh
docker compose logs -f
curl http://localhost:3000/health
docker compose restart storytelling
docker compose down
```

**All rooms and memberships live in memory. Restarting the process clears everything.** No volumes or database are needed. Use exactly one server instance; replicas would have independent rooms. A new deployment also clears rooms.

## Play

1. Choose a nickname and create a room, or join using its name or invite link.
2. Pick one of `1, 2, 3, 5, 8, 13, 20`. Change your vote until reveal.
3. Once every active participant has voted, anyone can reveal the round.
4. A difference of at least two positions in the deck starts **Discussion time / Diskussionsrunde**, showing names and votes. Equal or adjacent cards show anonymous votes and an arithmetic mean rounded to at most two decimal places.
5. Anyone can start a new round after confirming. There are no story titles or history.

Nicknames are unique per room after trimming, Unicode normalization, and case folding with `toLowerCase`. New arrivals enter an unrevealed round immediately; arrivals after reveal wait for the next round. Disconnected members still count. Anyone can remove a member after confirmation; that member's vote is also deleted. Removing a voter after reveal recalculates the current result from remaining votes. Empty rooms disappear only when the final member explicitly leaves or is removed.

Membership credentials and language preference are saved in browser local storage. Refreshes and reconnects restore your membership and own vote; tabs using the same credential represent the same participant. Leaving or removal revokes membership. Clearing browser storage loses your credential; another participant can remove the old membership. If storage is unavailable, the current tab still works but cannot restore membership after refresh. The preferred browser language chooses German when its primary language is German, otherwise English. The selector overrides it locally. Means use localized decimal separators.

## HTTPS reverse proxy

Use HTTPS for internet access. With Caddy running on the host:

```caddyfile
poker.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Point DNS at the server, permit ports 80/443, and run Compose with `BIND_ADDRESS=127.0.0.1`. Caddy automatically obtains TLS certificates and forwards WebSocket upgrades. If Caddy is in another container, connect it to the Compose network and proxy to `storytelling:3000` instead. Preserve the original `Host` header; the server validates browser WebSocket origins against it. For nginx, forward HTTP/1.1 `Upgrade`, `Connection`, and `Host` headers and use a read timeout longer than the 15-second heartbeat interval. The frontend automatically uses `wss://` on HTTPS pages.

Anyone with the room name/link can join and manage rounds or participants. Credentials are opaque random tokens checked on every action. Before reveal, the wire protocol includes only the recipient's own vote and an aggregate missing count, never other participants' votes or voting flags. Do not log WebSocket message bodies because resume messages contain credentials. The server limits message size, per-connection action rate, and slow-client output buffering; this is a small team tool, so apply proxy connection limits if exposing it broadly.

## Local development and verification

Requires Node.js 22+.

```sh
npm ci
npm test
npm run build
npm start
```

`npm run dev` watches server changes; rebuild the frontend after changes using `npm run build`. The server always serves `dist/client`. `npm run check` runs TypeScript alone. Tests cover domain rules, privacy, membership, races, HTTP/WebSocket integration, and translations. Docker builds run the tests and type checks before producing the non-root runtime image.

For browser tests after building:

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

The browser suite uses separate English and German contexts, 320px and 390px viewports, and accessibility scans. It covers invitations, refreshing votes, anonymous means and localized decimals, discussions, late arrivals, reset confirmations, removals, leaving, nickname errors, and saved language choice. It starts its own server on port 3100. Browser binaries are only needed for these tests, not for running the app or building its container.

For a manual connection check, disconnect a phone from the network, wait for the heartbeat to detect the lost connection, and confirm that actions are disabled and the status indicates reconnection; rejoin the network and verify the vote returns. The interface uses native modal dialogs, pressed states, and live status announcements.
