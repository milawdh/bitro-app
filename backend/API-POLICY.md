# BitroLearn API Policy

This document is the development contract for the backend API. Every controller must declare its area, route, authorization policy, and request/response contract. The backend remains one .NET 10 executable project with one shared PostgreSQL database.

## Areas and routes

| Area | Prefix | Purpose | Default access |
|---|---|---|---|
| `public` | `/public` | Public website and shared endpoints | Authenticated unless the action explicitly permits anonymous access |
| `admin` | `/admin` | Administration endpoints | Password authentication and an authorized staff role |
| `app` | `/app` | Learner account and dashboard endpoints | An independently authenticated app-user OTP session |

- Routes start directly with the area prefix. Do not add an `/api` prefix.
- Place controllers under their corresponding `Controllers/Public`, `Controllers/Admin`, or `Controllers/App` folder and inherit from the area's base controller.
- The `Area` attribute, explicit lowercase route prefix, and API documentation group must agree.
- Shared endpoints belong to `public`. Do not create an additional `shared` area or prefix.
- A protected shared action must explicitly identify the applicable account store or area selector. Do not merge admin and app principals merely to reuse an endpoint.
- An area name is not an authorization rule. Base controllers apply the appropriate policy, while anonymous actions explicitly use `AllowAnonymous`.
- Never put `AllowAnonymous` on the public base controller. Doing so would silently disable authorization for protected shared endpoints.
- `/scalar` and `/openapi/v1.json` are documented infrastructure exceptions. They exist only when API documentation is enabled.

## Authentication and roles

- Learners authenticate using a verified phone number and an OTP. Create a new learner only after successful phone verification.
- Staff authenticate using an email-shaped username and a password. OTP must never provide an alternative way into administration.
- Administration role names are `editor`, `admin`, and `superadmin`. App users have no Identity roles. Never accept a role assignment from an authentication request.
- Use two independent `HttpOnly` cookies and authentication schemes: `bitro.admin.auth` / `Bitro.Admin` and `bitro.app.auth` / `Bitro.App`. Never merge principals from the two schemes. Each area validates only its own account store and cookie.
- A password-authenticated superuser satisfies all administration permission policies. It is not an app-user session and does not bypass app authentication. Input validation, CSRF protection, and account-health checks still apply.
- Validate the account's active status, current roles, and security stamp against the database on protected requests. A stale cookie must not bypass suspension or role changes.
- In this initial version, logout updates the corresponding account security stamp and invalidates its sessions in that account store. Logging out of one area must not remove or invalidate the other area cookie.
- App users live in a separate `AppUsers` table without passwords, email usernames, or Identity roles. Administration accounts use the independent `AdminUsers` Identity store with email-shaped usernames. A phone number matching information on an admin account must not link the two identities.
- Future purchased-course access belongs to learner entitlements and ownership checks, not app roles.

## Request protection and contracts

- Cookie-authenticated state-changing requests require a CSRF token in `X-CSRF-TOKEN`. Login and OTP requests are included.
- `GET /public/auth/csrf?area=app` returns an app token; `?area=admin` returns an admin token. The default area is `app`. Token generation authenticates only the selected scheme. Fetch a fresh token after that area identity changes, including login and logout.
- Use `GET` for reads. A read endpoint must not mutate application state.
- Check ownership before exposing or modifying a user's drafts, projects, progress, or private files. A client-supplied user ID never replaces the authenticated server identity.
- Return explicit response DTOs. Do not serialize database entities, correct answers, password hashes, security stamps, or secrets directly.
- Validate input and propagate request cancellation to database and external-service operations.
- Use `ProblemDetails` for errors and `ValidationProblemDetails` for field-level validation errors. Include a request identifier that can be correlated with logs.
- Return `401` for missing/invalid authentication, `403` for insufficient permission, `400` for invalid input, `409` for conflicting updates, and `429` for rate limits. API failures must not redirect to a login page.
- Return a controlled `503` when a required dependency such as OTP Redis is unavailable. Never fall back to accepting an unverified login.

## OTP and multiple instances

- `ISMSProvider.SendOTPSMS(phoneNumber, code)` is the provider replacement boundary. The current console provider writes only the phone number and code; it sends no external SMS.
- Never include the OTP in API responses or normal application logs. The requested console provider is the explicit local delivery mechanism.
- Generate OTPs with a cryptographic random generator. Store only a keyed hash with an expiry in shared Redis.
- Verification, failed-attempt accounting, and successful consumption must be atomic. Concurrent requests to different instances must not consume the same code successfully twice.
- Enforce resend cooldown and phone/IP limits through shared Redis. Per-instance memory is not the authority for OTP validity or global limits.
- Share persisted Data Protection keys and the application name across instances. Replacing a container or routing a request to a different instance must not break a valid cookie.
- Normal web startup must not migrate or seed the database. Initialization runs separately under a database lock.

## Documentation, configuration, and logging

- Serve the documentation UI at `/scalar` and its document at `/openapi/v1.json`.
- `BITRO_OPENAPI_ENABLED` controls both endpoints. When disabled, both return `404`.
- Group documented operations into `Public`, `Admin`, and `App`. Distinguish anonymous operations from protected ones.
- Define application environment-variable names as constants in `AppConfigurationStatic` and read them through its typed getters.
- `ReadEnv` returns the first nonblank value in this exact order: `Process`, `User`, `Machine`. The local `.env` file fills only values missing in all three scopes.
- Keep the real `.env`, initial password, OTP key, and storage credentials out of Git, container images, and API responses.
- Write structured logs to container output. Do not log passwords, cookies, complete personal code, or connection strings.

## Persistence and code organization

- Do not use application-managed PostgreSQL transactions: no `BeginTransaction`, `TransactionScope`, manual `BEGIN`, or application-controlled commit/rollback workflow.
- Design each write as an atomic statement, an optimistic compare-and-set update, or an idempotent operation protected by database constraints. Initialization must resume safely after interruption without overwriting existing content or credentials.
- Framework-internal database behavior, including implicit `SaveChanges` and migration implementation details, does not create an application transaction API and must not be used to design a manual multi-step workflow.
- All Redis access goes through the shared infrastructure wrapper. Controllers and business services must not reference Redis client types or execute Lua scripts directly.
- Prefer native Redis commands and conditional atomic batches. There are no Lua scripts in the current implementation. If a future requirement genuinely needs Lua, store every script in one static `RedisScripts` class with named regions; never inline scripts in services.
- Use the wrapper's conditional atomic batch for state changes that require compare-and-set semantics. These Redis operations are separate from the ban on application-managed PostgreSQL transactions.
- Group C# code with meaningful `#region` blocks, such as configuration keys, validation, request handling, and persistence operations. Regions must describe a coherent responsibility.
- Keep business limits in named configuration settings. OTP lifetime, resend interval, allowed attempts, phone/IP limits, lock duration, and rate window must not be hidden numeric constants in services.
- Configure admin password attempt and lock limits through `BITRO_ADMIN_MAX_ATTEMPTS` and `BITRO_ADMIN_LOCK_SECONDS` as well.
- Run builds, tests, and migration commands inside Docker. A host-installed .NET SDK is not part of the supported execution workflow.

## Initial implementation boundary

Tasks one through three implement application infrastructure, environment configuration, schema and initial data, accounts, and authentication. Content management, progress operations, grading, and file uploads belong to later tasks. The existing frontends are not connected to the backend in this phase.
