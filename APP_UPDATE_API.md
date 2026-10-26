# App Update API

Run `mysql -u root -p skillforexport < scripts/add-app-update-policies.sql` before deploying the API. The script creates the table but does not seed a fake release or store URL.

## Public check

`GET /api/app-update?platform=android&current_version=2.3.1` requires no token. The version must use `major.minor.patch` with numeric components.

```json
{
  "success": true,
  "data": {
    "platform": "android",
    "current_version": "2.3.1",
    "latest_version": "2.5.0",
    "min_supported_version": "2.4.0",
    "update_status": "force",
    "store_url": "https://play.google.com/store/apps/details?id=com.example.app",
    "release_notes": "Bug fixes and improvements.",
    "released_at": "2026-10-15T09:00:00.000Z"
  }
}
```

`none` means installed version is at least the latest; `optional` means it is behind latest but still supported; `force` means it is below minimum supported. Versions are compared numerically, not alphabetically. The URL above is illustrative only; do not publish it.

If a platform has no published policy, the endpoint returns 404 with `update_policy_unavailable`. Mobile should treat unavailable policy or network failure as *no new enforcement decision*: do not lock users out, and retry later. A malformed query is rejected. Only a previously fetched `force` response from a published policy should block app use. A public endpoint cannot prevent an offline client from using an old build.

## Admin management

Both endpoints require a bearer token for a granted superadmin (`GET /api/admin/users/me` returns `data.isSuperAdmin`). Ordinary admins receive 403.

- `GET /api/admin/app-updates` lists configured policies, including drafts.
- `PUT /api/admin/app-updates/:platform` replaces the `android` or `ios` policy. Body:

```json
{
  "latestVersion": "2.5.0",
  "minSupportedVersion": "2.4.0",
  "storeUrl": "https://play.google.com/store/apps/details?id=com.example.app",
  "releaseNotes": "Bug fixes and improvements.",
  "releasedAt": "2026-10-15T09:00:00Z",
  "isPublished": false
}
```

The admin form must use the real store listing URL and independently confirm that the release is available to users before setting `isPublished: true`. Publishing requires `releasedAt`; `minSupportedVersion` cannot exceed `latestVersion`. Android URLs must be HTTPS `play.google.com/store/apps/details`; iOS URLs must be HTTPS `apps.apple.com`. Unpublished policies are not returned by the public endpoint. Leave iOS unconfigured until the real App Store listing exists; never substitute another app's URL or version.

To roll out safely, first publish a new latest version with the prior minimum, which gives users an optional update. Raise the minimum only after the replacement release is available to the intended audience. For staged rollouts, do not force everyone to a release that only some users can install.

## Frontend handoff

> Mobile: call `GET /api/app-update` without authentication on startup, sending `platform` and installed `major.minor.patch` version. Show release notes and a store link for `optional`; for `force`, block normal navigation and provide the store link. For `none`, proceed normally. Treat `update_policy_unavailable` and transient network errors as no new enforcement decision and retry later. Do not compare version strings locally or use an app's name as the version.
>
> Admin: add a superadmin-only App Updates page. Read `GET /api/admin/app-updates`, edit each platform through `PUT /api/admin/app-updates/:platform`, and clearly distinguish draft from published policy. Confirm the real store release is live before publishing or raising minimum support. Show API validation errors and refresh the policy after save. Do not create an iOS policy using another application's App Store data.
