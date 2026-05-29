# Security Policy

## Supported versions

PondiFarmApp is in **Phase 0 — Validation**. Only the latest `main` branch and the most recent tagged release receive security fixes at this stage. There is no extended support window.

| Version           | Supported           |
|-------------------|---------------------|
| `main` (head)     | :white_check_mark:  |
| Latest release    | :white_check_mark:  |
| Older releases    | :x:                 |

## Reporting a vulnerability

If you discover a security vulnerability in PondiFarmApp, **do not open a public issue**.

Please report it privately by emailing **`projects@eurounionconsult.com`** with the subject line:

> `[security] PondiFarmApp — short description`

Include, where possible:

- A clear description of the issue.
- Affected component (`backend`, `mobile`, CI workflows, dependencies).
- Steps to reproduce.
- The impact you have observed or expect.
- Any proof-of-concept code or screenshots that help triage.

### What to expect

- Acknowledgement of your report within **5 working days**.
- A first assessment and proposed mitigation timeline within **15 working days**.
- Coordinated disclosure once a fix has been deployed, with credit to the reporter unless anonymity is requested.

We ask reporters not to disclose the vulnerability publicly until a fix has been released and coordinated communications have been agreed upon.

## Out of scope

The following items are generally outside the scope of our security programme at this stage:

- Findings on dependencies that are already tracked by Dependabot and have a patch pending.
- Theoretical denial-of-service issues without a clear exploit path.
- Social-engineering or physical-access scenarios.
- Bugs in third-party services that PondiFarmApp integrates with (please report those to the upstream maintainers).

## Bug bounty

PondiFarmApp does not currently operate a paid bug-bounty programme. Reporters acting in good faith are credited in release notes and in `CHANGELOG.md`.

## Contact

`projects@eurounionconsult.com`
