<h1 align="center" style="color: mediumseagreen;font-weight: bold;">
Infrastructure  Release Notes - v18.0.0
</h1>

<h2 align="center" style="font-weight: bold;">Features ✨</h2>

1. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Added a new composite action named `create-milestone.yml` to create GitHub milestones.
2. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Created a new workflow with the name `process-milestone.yml` to automate the milestone lifecycle after a release.
  - For production releases, it renames the `vnext` milestone to the release version, closes it, and creates a new `vnext`.
  - For preview releases it calculates the next preview version and creates a preview milestone.
3. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Created a new workflow with the name `validate-release.yml` that validates a release before a release is performed by doing the following:
  - Checks for the existence of the repo variables.
  - Validates that the tag does not already exist for the release.
  - Checks the dotnet SDK versions to see if they match what is set for the repo variable for the project.
  - Checks for the existence of the release notes.
  - Validates that a NuGet package for the current version being released does not already exist.
  - Validates that the milestone exists.
  - Checks that all of the milestone item are close/completed.
  - Checks that a GitHub release does not already exist.


<h2 align="center" style="font-weight: bold;">Enhancements 💎</h2>

1. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Enhanced the `release.yml` workflow by doing the following:
  - The workflow now uses the new `validate-release.yml` reusable workflow.
  - Added a new `process_milestone` job to handle milestone closing, renaming/creation, etc.
  - Added top-level `permissions: contents: read`
2. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Added the required input `version` to the `dotnet-lib-release.yml` workflow.
3. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - The `dotnet-lib-release.yml` workflow now uses local composite actions (`./actions/`) instead of versioned external references.
5. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Pinned all workflow jobs to run on a pinned version of Ubuntu.

<h2 align="center" style="font-weight: bold;">Breaking Changes 🧨</h2>

1. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Removed the internal `actions/checkout` step from the `transpile-readme.yml` workflow. Callers must now checkout the repository before using this action.
2. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Removed the `dotnet-action-release.yml` workflow.
3. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Removed the following inputs from the `dotnet-lib-release.yml` workflow: 
  - `deno-version`
  - `build-project`
  - `enable-deno-cache`
  - `runs-on`
  - `dry-run`
4. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Replaced the required secret input `nuget-org-api-key` with the required secret `nuget-user`.
  - NuGet now uses OIDC-based authentication (via `NuGet/login`) instead of a raw API key.
5. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - The `dotnet-lib-release.yml` workflow does not get and validate the version anymore.  The version is not sent in via a workflow input.
6. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - The `dotnet-lib-release.yml` workflow does not build projects anymore and now must be handled by the consumer workflow.


<h2 align="center" style="font-weight: bold;">Bug Fixes 🐛</h2>

1. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Fixed case-sensitivity bug in the `validate-version` action where the `inputs.VERSION` input was improperly named `inputs.version`.
2. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Fixed and issue with the `validate-version` action there the `VERSION` environment variable was incorrectly referencing `inputs.VERSION` (uppercase) instead of `inputs.version` (lowercase), causing the version value to be empty at runtime.
3. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Removed the unnecessary `actions/checkout` step from the `transpile-readme` action that was causing the action to checkout a repository even when the caller had already done so, leading to potential path conflicts.


<h2 align="center" style="font-weight: bold;">Dependency Updates 📦</h2>

1. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated `@atproto` package to v0.20.19
2. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the `build-status-check.yml` workflow from _**v2.0.4**_ to _**v2.0.5**_.
3. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the `lint-status-check.yml` workflow from _**v2.0.4**_ to _**v2.0.5**_.
4. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the `release.yml` workflow from _**v2.0.4**_ to _**v2.0.5**_.
5. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `close-milestone/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
6. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `get-deno-config-version/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
7. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `get-version/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
8. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `github-release-exists/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
9. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `jsr-pkg-exists/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
10. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `milestone-exists/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
11. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `milestone-items-closed/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
12. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `nuget-pkg-exists/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
13. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `release-notes-exist/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
14. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `rename-milestone/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
15. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `send-bluesky-release-announcement/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
16. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `send-x-release-announcement/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
17. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `transpile-readme/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
18. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `update-copyright/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
19. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `validate-sdk-versions/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
20. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `validate-tag/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
21. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the `denoland/setup-deno` in the composite action `validate-version/action.yml` from _**v2.0.4**_ to _**v2.0.5**_.
22. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Updated the version of deno used in all reusable workflow and composite actions from _**v2.7.14**_ to _**v2.9.x**_.

<h2 align="center" style="font-weight: bold;">Other 🪧</h2>

1. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Added `permissions: contents: read` to the following workflows:
  - `lint-status-check.yml`
  - `build-status-check.yml`
2. [#303](https://github.com/KinsonDigital/Infrastructure/issues/303) - Changed the event trigger of the `build-status-check.yml`  workflow from `pull_request_target` to `pull_request`.
