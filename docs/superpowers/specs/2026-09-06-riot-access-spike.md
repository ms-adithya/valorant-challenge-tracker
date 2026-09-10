# Riot API Access Spike — Findings and Branch Recommendation

**Date:** 2026-09-10  
**Status:** Complete  
**Author:** Valorant Challenge Tracker Core Team  
**Scope:** Research spike resolving Track S / Task 0 of the Cloud Backend and Accounts Plan  

---

## Executive Summary

This spike investigates the current terms, gating, endpoints, and approval timelines for the Riot Games Developer Portal (<https://developer.riotgames.com>), specifically addressing Riot Sign-On (RSO), the VALORANT Match API (`VAL-MATCH-V1`), and the Account API (`ACCOUNT-V1`).

### Verdict: **Branch N**

Under the authoritative Decision Gate matrix defined in `docs/superpowers/plans/2026-09-06-cloud-backend-phases-0-3.md`:

| Spike Outcome | Branch | Implication | Blaze Required |
|---|---|---|---|
| RSO and `VAL-MATCH-V1` granted | **Branch R** | Riot sign-in, verified PUUID | Yes |
| `VAL-MATCH-V1` only, no RSO | **Branch M** | Typed Riot ID, unverified PUUID | Yes |
| RSO only, no match access | **Branch R** | Riot sign-in as convenience; no auto-fetch | Yes |
| **Neither granted today** | **Branch N** | **Stop at Task 12; cloud storage & accounts complete** | **No (Free Spark)** |

**Decision:**
1. **Explicit Verdict: Branch N.** Because neither RSO client credentials nor `VAL-MATCH-V1` match access are granted today upon registration (both require full production application review taking 2–4+ weeks with a high bar for hobby tools), the explicit verdict is **Branch N**. Tasks 1 through 12 proceed unconditionally on the free Firebase Spark plan without blocking on third-party credentials or incurring Blaze billing.
2. **Future Path (Branch M or Branch R):** If the project later applies for production access on the developer portal, the parameters for Branch M (standard key resolving typed Riot IDs via the Account API) and Branch R (full RSO OpenID Connect flow) are fully documented below and ready to activate.

---

## 1. Answers to Core Questions

### Question 1: Can this project register for RSO today, and on what terms?
**Answer: No immediate self-service RSO registration is available.**

- **Gating:** Riot Sign-On (RSO) is an OAuth 2.0 / OpenID Connect service strictly restricted to approved **Production Applications**. It is **not** available under Personal Development API Keys.
- **Terms:** To qualify for RSO:
  1. A developer must register a product proposal on the Riot Developer Portal.
  2. The application must provide a functional URL or staging environment demonstrating the complete user experience.
  3. The product must display a compliant Privacy Policy and Terms of Service outlining data collection, retention, and deletion policies.
  4. The product must comply with the Riot Games API Policies, including strict player consent guidelines and prohibitions on paywalling core competitive stats.
  5. RSO client credentials (`client_id` and `client_secret`) are provisioned only after explicit review and approval by Riot's Developer Relations team.

### Question 2: What is the actual approval timeline?
**Answer: 2 to 4+ weeks for production/RSO access; instant for temporary development keys.**

- **Development API Keys:** Instantly generated via the portal dashboard upon signing in with a Riot account. They are valid for 24 hours and intended solely for testing non-restricted endpoints.
- **Personal Project Keys:** Review period typically takes 1 to 2 weeks, but does not grant access to RSO or `VAL-MATCH-V1`.
- **Production API Keys & RSO Client Access:** Review takes **2 to 4 weeks** under standard queue conditions, often extending to 6+ weeks if policy clarifications or revision cycles are requested.
- **Conclusion:** A parallel approval clock must be assumed. Production approval cannot block the delivery of Phase 1 (Firestore sync) and Phase 2 (Firebase Auth).

### Question 3: Is `VAL-MATCH-V1` access available to this project, and on what terms? Does RSO approval carry any implication for `VAL-MATCH-V1` access?
**Answer: No. `VAL-MATCH-V1` is strictly gated behind production approval, and RSO approval carries no automatic implication for match access.**

- Attempting to query `/val/match/v1/*` endpoints with a Personal Development API Key results in an HTTP `403 Forbidden` response.
- Access to VALORANT match data requires an approved Production Key with explicit approval for the VALORANT game title.
- Riot requires that all player match statistics fetched via API respect player privacy and opt-out preferences.
- **No Bundled Approval:** Gating for RSO and `VAL-MATCH-V1` is independent. Obtaining RSO credentials does not grant or imply VALORANT match access. An application may be approved for RSO (user authentication) while being denied match access, leading directly to the "Branch R: RSO only, no match access" scenario in the Decision Gate.

### Question 4: Are RSO and `VAL-MATCH-V1` gated separately?
**Answer: Yes, completely separately.**

- **Endpoint Viability:** The Account API endpoint `/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` **works with a standard API key** (including temporary development keys and personal keys) using the `X-Riot-Token` HTTP header.
- **Significance:** RSO is not required to look up a player's PUUID from their typed Riot ID (`gameName` and `tagLine`). This decouples player PUUID resolution from the RSO approval gate, making **Branch M** fully viable without RSO credentials.

---

## 2. Technical Specifications & Endpoint Values

### Branch R: Riot Sign-On (OAuth 2.0 / OpenID Connect)

These values are required for Cloud Functions in Tasks R1–R3:

| Parameter | Value | Notes |
|---|---|---|
| **Authorize URL** | `https://auth.riotgames.com/authorize` | User redirection endpoint |
| **Token URL** | `https://auth.riotgames.com/token` | Authorization code exchange endpoint (`POST`) |
| **JWKS URL** | `https://auth.riotgames.com/jwks.json` | Key set for verifying ID token JWTs |
| **User Info / Identity Endpoint** | `https://auth.riotgames.com/userinfo` | Returns player claims with Bearer token |
| **Account API Me Endpoint** | `https://{region}.api.riotgames.com/riot/account/v1/accounts/me` | Alternative PUUID endpoint using access token |
| **PUUID Location** | Claim `sub` in User Info or ID token; `puuid` in Account API | Verified unique player identifier |
| **Redirect URI** | `https://{domain}/riotAuthCallback` | Configured on portal; e.g. `https://valorant-challenge-tracker.web.app/riotAuthCallback` (or `http://localhost:5000/riotAuthCallback` in emulator) |
| **Client ID** | Provisioned upon production approval | Configured via Secret Manager as `RIOT_CLIENT_ID` |
| **Required Scopes** | `openid` (identity & `sub`), `offline_access` (refresh token) | String: `"openid offline_access"` or `"openid"` |
| **Authentication Headers** | `Authorization: Basic {base64(client_id:client_secret)}` (Token exchange)<br>`Authorization: Bearer {access_token}` (Account API / UserInfo) | Used by Task R2 during code exchange and account lookup |
| **PKCE Support** | Supported (RFC 7636) | `code_challenge`, `code_challenge_method=S256`, `code_verifier` |
| **Required Secrets** | `RIOT_CLIENT_ID`, `RIOT_CLIENT_SECRET`, `RIOT_STATE_SECRET` | Must be stored in Cloud Secret Manager |

### Branch M: Riot ID Resolution (Account API)

These values are required for Cloud Functions in Tasks M1–M2:

| Parameter | Value | Notes |
|---|---|---|
| **Endpoint** | `https://{routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` | HTTP GET. `{gameName}` and `{tagLine}` must be URL-encoded (RFC 3986) |
| **Regional Routing Clusters (`{routing}`)** | `americas`, `asia`, `europe`, `esports` | Closest cluster to the caller (e.g. `americas.api.riotgames.com`) |
| **Authentication Header** | `X-Riot-Token` | Header containing the API key (never pass in query string) |
| **Key Formats** | `RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Development or production key format |
| **Development Rate Limits** | 20 requests / 1 second<br>100 requests / 2 minutes | Standard development key tier |
| **Production Rate Limits (Default)** | 500 requests / 10 seconds<br>30,000 requests / 10 minutes | Approved production application tier |
| **Required Secrets** | `RIOT_API_KEY` | Must be stored in Cloud Secret Manager |

---

## 3. Comparative Evaluation: Branch R vs Branch M vs Branch N

| Criterion | Branch R (RSO) | Branch M (Riot ID) | Branch N (Stop at 12) |
|---|---|---|---|
| **Tasks** | 3 (R1–R3) | 2 (M1–M2) | 0 (Tasks 1–12 stand alone) |
| **User Experience** | One-click "Continue with Riot" | User types `GameName#TAG` once | Email / Password / Google sign-in only |
| **PUUID Trust** | **Verified** by Riot identity provider | **Unverified** (any valid ID can be typed) | N/A |
| **Key Dependency** | Production RSO Client approval | Standard Riot API Key | None |
| **Blaze Plan Required** | Yes (Cloud Functions) | Yes (Cloud Functions) | **No (Spark tier throughout)** |
| **Privacy Risk** | None (player explicitly authenticates) | Privacy concern if user enters third-party ID | None |

### Privacy & The Verification Gap
As highlighted in the specification, Branch M allows a user to input any player's `gameName#tagLine`. While competitive match stats are publicly viewable on sites like tracker.gg, linking an unverified PUUID to a personal challenge tracker creates an integrity and privacy asymmetry. Branch R resolves this via cryptographic proof of account ownership, whereas Branch N avoids the issue entirely.

---

## 4. Final Recommendation & Routing

1. **Execute Tasks 1–12 under the baseline of Branch N:**
   - Deliver Firebase Hosting, Firestore schema, offline sync, migration, email/password, and Google sign-in.
   - Project remains entirely on the free Firebase Spark tier.
   - All four Riot-shaped schema artifacts (`source="riot"`, `riotMatchId`, `riot` write-protection rules, `riotAccounts` deny-all) remain cleanly inert in the codebase as planned without runtime penalty.

2. **Parallel Product Application:**
   - If the product owners wish to offer Riot integration in the future, register a production application on <https://developer.riotgames.com> requesting RSO and VALORANT match access.
   - If production RSO is approved, implement **Branch R** (Tasks R1–R3).
   - If match access is granted but RSO is denied, implement **Branch M** (Tasks M1–M2).
   - If denied or unneeded, Branch N remains the permanent production posture.
