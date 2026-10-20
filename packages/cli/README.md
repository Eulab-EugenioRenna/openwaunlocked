# @eulab/openwaunlocked-cli

`@eulab/openwaunlocked-cli` provides the `wa` command for starting and managing an Open-WA session and API server. The CLI delegates session startup to `@eulab/openwaunlocked`.

Part of the [EULAB Open monorepo](https://github.com/Eulab-EugenioRenna/openwaunlocked).

## Install

```bash
npm install --global @eulab/openwaunlocked-cli@1.0.0
```

## Start the API server

```bash
wa --session-id main --host 127.0.0.1 --port 8080
```

Scan the QR code shown in the terminal to sign in. The server listens on `127.0.0.1:8080`; use `wa --help` to see the available options. Add an API key with `--api-key` when clients need authentication, and keep the server on loopback or a private network unless you have configured an appropriate access boundary.

## Remote clients

Use [`@eulab/openwaunlocked-socket-client`](https://openwa.dev/docs/client-and-integrations/socket-client) to send commands to this server and receive runtime events.

## Documentation

See the [CLI reference](https://openwa.dev/docs/guides/configuration-and-cli).

## License

[H-DNH 1.1](https://github.com/Eulab-EugenioRenna/openwaunlocked/blob/master/LICENSE.md) — Hippocratic + Do Not Harm
