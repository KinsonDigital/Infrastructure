<h1 align="center" style="color: mediumseagreen;font-weight: bold;">
Infrastructure Production Release Notes - v16.0.0
</h1>

<h2 align="center" style="font-weight: bold;">New Features</h2>

1. [#267](https://github.com/KinsonDigital/Infrastructure/issues/267) - Created new developer tools:
   - Created a new tool to easily create a pull request.
   - Created a new tool to easily generate release notes.
2. [#269](https://github.com/KinsonDigital/Infrastructure/issues/269) - Created the following custom composite GitHub actions:
   - close-milestone
   - get-version
   - github-release-exists
   - milestone-exists
   - milestone-items-closed
   - nuget-pkg-exists
   - release-notes-exist
   - send-x-release-announcement
   - transpile-readme
   - update-copyright
   - validate-sdk-versions
   - validate-tag
   - validate-version
3. [#269](https://github.com/KinsonDigital/Infrastructure/issues/269) - Added the following inputs to the ***dotnet-lib-release.yml*** and ***dotnet-action-release.yml*** workflows.
   - `release-notes-file-path` - Fully qualified path.  It is the consumer's responsibility to build the path now.
   - `deno-version` - The version of deno to use.  This input is replacing all of the `DENO_VERSION` variable references
   - `enable-deno-cache` - Default is true, but now uses caching for deno scripts. 

<h2 align="center" style="font-weight: bold;">Breaking Changes 🧨</h2>

1. [#269](https://github.com/KinsonDigital/Infrastructure/issues/269) - Introduced the following breaking changes:
   - Removed the following inputs to the ***dotnet-lib-release.yml*** and ***dotnet-action-release.yml*** workflows.
     - `relative-release-notes-dir-path` - Use the new `release-notes-file-path` input instead.
     - `release-notes-file-name-prefix`
     - `run-branch`
     - `pr-include-notes-label`
   - Removed the `run-csharp-tests.yml` workflow.
   - Removed the `run_tests` job from the _**dotnet-lib-release.yml**_ workflow.
   - Removed the `run_tests` job from the _**dotnet-action-release.yml**_ workflow.
   - Removed the _**docusaurus-release.yml**_ workflow.
   - Removed the _**validate-tag.yml**_ workflow.
   - Replaced the variable `CICD_SCRIPTS_VERSION` with the variable `INFRASTRUCTURE_VERSION`.
