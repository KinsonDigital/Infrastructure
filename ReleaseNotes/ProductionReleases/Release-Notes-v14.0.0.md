<h1 align="center" style="color: mediumseagreen;font-weight: bold;">
Infrastructure Production Release Notes - v14.0.0
</h1>

<h2 align="center" style="font-weight: bold;">Enhancements 💎</h2>

1. [#233](https://github.com/KinsonDigital/Infrastructure/issues/233) - Updated the dotnet lib reusable release workflow to include debug symbols.

<h2 align="center" style="font-weight: bold;">Bug Fixes 🐛</h2>

1. [#226](https://github.com/KinsonDigital/Infrastructure/issues/226) - Fixed an issue with PR descriptions during the initial sync process.

<h2 align="center" style="font-weight: bold;">Breaking Changes 🧨</h2>

1. [#213](https://github.com/KinsonDigital/Infrastructure/issues/213) - Improved security by doing the following:
   - Removed all code related to printing out script arguments to the console.
   - Replaced all script arguments with environment variables.

<h2 align="center" style="font-weight: bold;">Technical Debt 🧽</h2>

1. [#213](https://github.com/KinsonDigital/Infrastructure/issues/213) - Renamed the _**validate-sdk-setup.yml**_ workflow to _**validate-sdk-versions.yml**_.
   - This will require updating all reusable workflow references in the project that point to this workflow.
2. [#221](https://github.com/KinsonDigital/Infrastructure/issues/221) - Removed the prepare release process.
3. [#218](https://github.com/KinsonDigital/Infrastructure/issues/218) - Improved the create script job in the _**resolve-csharp-proj-file.yml**_ workflow.

<h2 align="center" style="font-weight: bold;">CICD ⚙️</h2>

1. [#225](https://github.com/KinsonDigital/Infrastructure/issues/225) - Changed the dotnet lib release workflow input with the name `release-notes-file-name-prefix` to optional.
2. [#222](https://github.com/KinsonDigital/Infrastructure/issues/222) - Changed the dotnet action release workflow input with the name `release-notes-file-name-prefix` to optional.
3. [#222](https://github.com/KinsonDigital/Infrastructure/issues/222) - Improved the create GitHub release step in the _**dotnet-action-release.yml**_ and _**dotnet-lib-release.yml**_ workflows.
4. [#218](https://github.com/KinsonDigital/Infrastructure/issues/218) - Added trimming to various repo variables to reduce accidental breaking of workflows.
5. [#201](https://github.com/KinsonDigital/Infrastructure/issues/201) - Created a release workflow.

<h2 align="center" style="font-weight: bold;">Configuration 🛠️</h2>

1. [#223](https://github.com/KinsonDigital/Infrastructure/issues/223) - Setup the [kdadmin](https://github.com/kinsondigital/kd-admin) dev tool.
