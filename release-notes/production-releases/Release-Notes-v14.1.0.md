<h1 align="center" style="color: mediumseagreen;font-weight: bold;">
Infrastructure Production Release Notes - v14.1.0
</h1>

<h2 align="center" style="font-weight: bold;">Bug Fixes 🐛</h2>

1. [#243](https://github.com/KinsonDigital/Infrastructure/issues/243) - Fixed env vars in dotnet release workflow.
2. [#242](https://github.com/KinsonDigital/Infrastructure/issues/242) - Added a check for the release notes for dotnet library releases.

<h2 align="center" style="font-weight: bold;">CICD ⚙️</h2>

1. [#243](https://github.com/KinsonDigital/Infrastructure/issues/243) - Fixed an issue where the following environment variables in the dotnet library release workflow was incorrect:
   - `BASE_SEARCH_DIR_PATH`
   - `NET_SDK_VERSION`
