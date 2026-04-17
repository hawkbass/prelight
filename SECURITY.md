# Security Policy

## Scope

Prelight is a build-time / test-time library. It reads source code, renders React components to static HTML, and computes text layout predictions. It does not execute user input at runtime, does not open network connections, and does not handle credentials.

The realistic security surface is:

- Malicious strings or font names causing denial-of-service in the verifier (e.g., pathological inputs to `@chenglou/pretext`)
- A compromised upstream dependency (Pretext, `@napi-rs/canvas`, `react-dom`)
- Code-injection via a `prelight.config.tsx` that a CI pipeline loads and executes

The `prelight.config.tsx` loader runs user code by design — that's the point of a config file. If you are loading a config file from untrusted source, you already have a larger problem.

## Reporting a vulnerability

Please report vulnerabilities privately, not through GitHub Issues.

**Preferred:** open a [GitHub security advisory](https://github.com/prelight/prelight/security/advisories/new) on the repository.

**Alternative:** email `security@prelight.dev` (address to be confirmed before v0.1.0; until then, reach out to the maintainer directly).

Please include:

- A description of the vulnerability and its potential impact
- Minimal reproduction steps or a proof-of-concept
- The affected package and version
- Your disclosure timeline, if any

We will acknowledge receipt within 72 hours and aim to ship a fix within 14 days for high-severity issues, or document the reasoning if a shorter timeline isn't feasible.

## Supported versions

Only the current minor version is supported in v0.1. Once 1.0 ships, we will maintain the latest two minor versions.
