<h1 align="center" style="color: mediumseagreen;font-weight: bold;">
Infrastructure Production Release Notes - v17.2.0
</h1>


<h2 align="center" style="font-weight: bold;">Features</h2>

1. [#289](https://github.com/KinsonDigital/Infrastructure/issues/289) - Added a new workflow input to the `dotnet-lib-release.yml` reusuable workflow for enabling or disable telemetry in dotnet projects that implement, use, and track telemetry.
2. [#292](https://github.com/KinsonDigital/Infrastructure/issues/292) - Created a new custom GitHub action that pulls the version from a `deno.json` configuration file.
3. [#293](https://github.com/KinsonDigital/Infrastructure/issues/293) - Created a new GitHub action that renames a GitHub milestone.


<h2 align="center" style="font-weight: bold;">Breaking Changes</h2>

1. [#293](https://github.com/KinsonDigital/Infrastructure/issues/293) - Removed the `deno-version` input from the following GitHub actions:
   - `close-milestone`
   - `get-version`
   - `github-release-exists`
   - `jsr-pkg-exists`
   - `milestone-exists`
   - `milestone-items-closed`
   - `nuget-pkg-exists`
   - `release-notes-exist`
   - `rename-milestone`
   - `send-bluesky-release-announcement`
   - `send-x-release-announcement`
   - `transpile-readme`
   - `update-copyright`
   - `validate-sdk-versions`
   - `validate-tag`
   - `validate-version`


<h2 align="center" style="font-weight: bold;">Tech Debt</h2>

1. [#263](https://github.com/KinsonDigital/Infrastructure/issues/263) - Removed the old twitter repo tokens, secrets, and repo variables.


<h2 align="center" style="font-weight: bold;">Dependency Updates</h2>

1. [#294](https://github.com/KinsonDigital/Infrastructure/issues/294) - Updated the following dependencies:
   - Updated _**kd-clients**_ to version _**v1.0.0-preview.16**_
   - Updated _**@std/fs**_ to version _**v1.0.23**_
   - Updated _**@std/path**_ to version _**v1.1.4**_
   - Updated _**@std/async**_ to version _**v1.3.0**_
   - Updated _**@atproto/api**_ to version _**v0.19.18**_
   - Updated _**@cliffy**_ references to version _**v1.0.1**_
