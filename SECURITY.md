# Security Policy

## Supported Versions

We actively provide security patches and updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

The Valorant Challenge Tracker team takes security seriously. If you believe you have discovered a security vulnerability regarding data persistence, Firestore Security Rules, or client authentication, please report it responsibly.

### How to Report Privately
**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, please report via one of the following methods:
1. **GitHub Private Vulnerability Reporting** (Preferred):
   - Navigate to the [Security tab](https://github.com/ms-adithya/valorant-challenge-tracker/security) of this repository.
   - Click **Report a vulnerability** to open an advisory draft.
2. **Email**:
   - Send details to the repository maintainer: `adithyams64203@gmail.com`

### What to Include in Your Report
To help us triage and resolve the issue quickly, please include:
- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions or a minimal Proof of Concept (PoC) to reproduce the behavior.
- Relevant files, functions, or Firestore rules involved.
- Any suggested fixes or mitigations (if available).

---

## Our Response Process
1. **Acknowledgment**: We aim to acknowledge receipt of your vulnerability report within 48 hours.
2. **Assessment & Confirmation**: We will investigate the issue and provide a confirmation or request for further clarification.
3. **Patching & Coordinated Disclosure**: Once confirmed, a fix will be implemented on a private branch, verified via automated rules and unit tests, and deployed. We will coordinate with you before publicly disclosing the advisory.
