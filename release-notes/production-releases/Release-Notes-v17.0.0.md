<h1 align="center" style="color: mediumseagreen;font-weight: bold;">
Infrastructure Production Release Notes - v17.0.0
</h1>

<h2 align="center" style="font-weight: bold;">Bug Fixes 🐛</h2>

1. [#274](https://github.com/KinsonDigital/Infrastructure/issues/274) - Fixed an issue with the `dotnet-lib-release.yml` workflow where the `runs-on` workflow input was not being utilized for the build job but was utilized for all other jobs that did not matter.
2. Fixed various issues with the release notes generator
   - A new requirement has been introduced where the `issueCategoryLabelMappings`, `issueCategoryIssueTypeMappings`, and `prCategoryLabelMappings` setting properties are not aloud to contain emojis for the generate release notes settings file. This meas that instead of the prop name being the value of the category, and the prop value being the name of the label or issue type, it is the other way around.  Since emojis in prop names cannot be parse from JSON to a JS object, we cannot use emojis in prop names.
   - ⚠️WARNING⚠️ This change means that all projects who update to v17.0.0 must update their release note generation settings by removing emojis from the prop names.  This also means 

<h2 align="center" style="font-weight: bold;">Features ✨</h2>

1. [#277](https://github.com/KinsonDigital/Infrastructure/issues/277) - Created a new action for sending Bluesky release announcements.
2. [#276](https://github.com/KinsonDigital/Infrastructure/issues/276) - Added the following to the `Send X Announcement Action`:
   - Added a workflow input with the name `website-url` to be replaced via a template injection variable with the name `WEBSITE_URL` in a release announcement template.
   - Added the ability to use a local file path to a release announcement template file.
     - The name of the new optional workflow input is `local-post-template-file-path`. If this workflow input is provided, then the `post-template-repo-name`, `post-template-branch-name`, and `post-template-repo-relative-file-path` will be ignored.

<h2 align="center" style="font-weight: bold;">Enhancements 💎</h2>

1. [#275](https://github.com/KinsonDigital/Infrastructure/issues/275) - Removed the ability to send X release announcements from the `dotnet-lib-release.yml` workflow.
2. [#276](https://github.com/KinsonDigital/Infrastructure/issues/276) - Made the following improvements to the `Send X Announcement Action`.
   - Added the ability to internally verify that the repository that contains the template exists.
   - Changed the `post-template-repo-name` workflow input from required to optional.
     - (Used to be named `release-x-post-template-repo-name`)
   - Changed the `post-template-branch-name` workflow input from required to optional.
     - (Used to be named `release-x-post-template-branch-name`)
   - Changed the `post-template-repo-relative-file-path` workflow input from required to optional.
     - (Used to be named `relative-release-x-post-template-file-path`)
   - Changed the `discord-invite-code` workflow input from required to optional.
   - Greatly improved the workflow input docs.

<h2 align="center" style="font-weight: bold;">Breaking Changes 🧨</h2>

1. [#276](https://github.com/KinsonDigital/Infrastructure/issues/276) - Introduced the following breaking changes to the `Send X Release Announcement` action:
   - Renamed the workflow input `release-x-post-template-repo-name` to `post-template-repo-name`.
   - Renamed the workflow input `release-x-post-template-branch-name` to `post-template-branch-name`.
   - Renamed the workflow input `relative-release-x-post-template-file-path` to `post-template-repo-relative-file-path`.
   - Removed the workflow input `repo-name`. This value was not being used for anything useful.
2. [#275](https://github.com/KinsonDigital/Infrastructure/issues/275) - Removed the following workflow inputs from the `dotnet-lib-release.yml` reusable workflow.
   - `send-x-release-post`
   - `x-consumer-api-key`
   - `x-consumer-api-secret`
   - `x-access-token-key`
   - `x-access-token-secret`
