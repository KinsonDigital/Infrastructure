<h1 align="center" style="color: mediumseagreen;font-weight: bold;">
Infrastructure Production Release Notes - v15.0.0
</h1>

<h2 align="center" style="font-weight: bold;">Project-Config</h2>

1. [#264](https://github.com/KinsonDigital/Infrastructure/issues/264) - Updated the kd-admin tool to version ***v1.0.0-preview.8***.

<h2 align="center" style="font-weight: bold;">Tech-Debt</h2>

1. [#259](https://github.com/KinsonDigital/Infrastructure/issues/259) - Fixed typescript errors.
2. [#144](https://github.com/KinsonDigital/Infrastructure/issues/144) - Made various improvements throughout the code base such as refactoring, deleting dead code, and more.

<h2 align="center" style="font-weight: bold;">Breaking Changes 🧨</h2>

1. [#144](https://github.com/KinsonDigital/Infrastructure/issues/144) - Implemented various improvements.
   - Changed the _**dotnet-lib-release.yml**_ workflow input name `send-release-tweet` to `send-x-release-post`
   - Renamed the following organization environment variables in the ***dotnet-lib-release.yml*** workflow:
     - `RELEASE_TWEET_TEMPLATE_REPO_NAME` renamed to `RELEASE_X_POST_TEMPLATE_REPO_NAME`
     - `RELEASE_TWEET_TEMPLATE_BRANCH_NAME` renamed to `RELEASE_X_POST_TEMPLATE_BRANCH_NAME`
     - `RELATIVE_RELEASE_TWEET_TEMPLATE_FILE_PATH` renamed to `RELATIVE_RELEASE_X_POST_TEMPLATE_FILE_PATH`
   - Renamed the following secret workflow inputs in the _**dotnet-lib-release.yml**_ workflow:
     - `twitter-consumer-api-key` renamed to `x-consumer-api-key`
     - `twitter-consumer-api-secret` renamed to `x-consumer-api-secret`
     - `twitter-access-token` renamed to `x-access-token-key`
     - `twitter-access-token-secret` renamed to `x-access-token-secret`
   - Replaced the following environment variables:
     - `TWITTER_BROADCAST_ENABLED` replaced by `X_BROADCAST_ENABLED`
     - `TWITTER_ACCESS_TOKEN_KEY` replaced by `X_ACCESS_TOKEN_KEY`
     - `TWITTER_ACCESS_TOKEN_SECRET` replaced by `X_ACCESS_TOKEN_SECRET`
     - `TWITTER_CONSUMER_API_KEY` replaced by `X_CONSUMER_API_KEY`
     - `TWITTER_CONSUMER_API_SECRET` replaced by `X_CONSUMER_API_SECRET`
