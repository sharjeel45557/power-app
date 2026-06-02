# Microsoft Entra ID (Azure AD) setup

This guide is for **IT / the Entra administrator**. It creates the App
Registration that power-app uses for Microsoft SSO. Development does **not** need
this — the app runs with `AUTH_MODE=mock` until these values are supplied.

## 1. Register the application

In the [Entra admin center](https://entra.microsoft.com) → **Identity** →
**App registrations** → **New registration**:

| Field | Value |
| --- | --- |
| **Name** | `power-app` (or per environment, e.g. `power-app-prod`) |
| **Supported account types** | *Accounts in this organizational directory only* (single tenant) |
| **Redirect URI** | **Web** → `https://<your-app-host>/auth/callback` |

For local testing against real Entra, also add `http://localhost:8080/auth/callback`.

After creating it, note from the **Overview** page:

- **Application (client) ID** → `OIDC_CLIENT_ID`
- **Directory (tenant) ID** → used in `OIDC_AUTHORITY`

## 2. Create a client secret

**Certificates & secrets** → **New client secret**. Copy the **Value**
immediately (it is shown only once) → `OIDC_CLIENT_SECRET`.

> Prefer short expiries and rotate. The value goes into the `power-app-config`
> user-provided service in Cloud Foundry, never into the repo or manifest.

## 3. Configure tokens & permissions

- **API permissions** → Microsoft Graph → **Delegated** → ensure `openid`,
  `profile`, `email` are present. Grant admin consent.
- **Token configuration** → **Add groups claim** → select **Security groups**
  (and emit **Group ID**). This puts the user's group object-ids into the token
  so power-app can map them to roles.
- **(Optional, for SharePoint connectors)** add **Application** permissions —
  e.g. `Sites.Selected` (preferred, then grant the app access to specific sites)
  or `Sites.ReadWrite.All` — and grant admin consent. The app then accesses
  SharePoint lists app-only; see [connectors.md](connectors.md).

> If users belong to many groups Entra may emit a "groups overage" claim instead
> of the list. If that affects your tenant, tell the dev team — we'll switch to
> resolving groups via the Graph API (planned for Phase 3).

## 4. Map groups to application roles

power-app roles are derived from Entra **security groups**. Decide a mapping,
e.g.:

| Entra security group | Group object-id | power-app role |
| --- | --- | --- |
| `PowerApp-Admins` | `<guid>` | `admin` |
| `PowerApp-Editors` | `<guid>` | `editor` |
| *(everyone else)* | — | `viewer` (default) |

This becomes the `ROLE_MAPPINGS` JSON (see below).

## 5. Environment values for the app

Provide these to the app (via `cf set-env` or the `power-app-config`
user-provided service — see [deployment-cloudfoundry.md](deployment-cloudfoundry.md)):

```bash
AUTH_MODE=entra
OIDC_AUTHORITY=https://login.microsoftonline.com/<TENANT_ID>/v2.0
OIDC_CLIENT_ID=<application-client-id>
OIDC_CLIENT_SECRET=<client-secret-value>
OIDC_REDIRECT_URI=https://<your-app-host>/auth/callback
OIDC_SCOPES=openid profile email
ROLE_MAPPINGS={"<admins-group-guid>":"admin","<editors-group-guid>":"editor"}
DEFAULT_ROLE=viewer
```

The redirect URI here **must** exactly match one registered in step 1.

## 6. Verify

With `AUTH_MODE=entra` set, browse to the app and click **Sign in with
Microsoft**. You should be redirected to Microsoft, authenticate, and land back
signed in. Check that your role reflects your group membership (visible in the
header and enforced on actions).
