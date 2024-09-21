// deno-lint-ignore-file no-unused-vars

import closeMilestoneExecutor from "./close-milestone.ts";
import githubReleaseDoesNotExistExecutor from "./github-release-does-not-exist.ts";
import labelIfHeadBranchExecutor from "./label-if-head-branch.ts";
import milestoneItemsAllClosedExecutor from "./milestone-items-all-closed.ts";
import nugetPkgDoesNotExistExecutor from "./nuget-pkg-does-not-exist.ts";
import prepareReleaseExecutor from "./prepare-release.ts";
import syncPrToIssueExecutor from "./sync-pr-to-issue.ts";
import transpileReadMeExecutor from "./transpile-readme.ts";
import validateTagExecutor from "./validate-tag.ts";
import validateVersionExecutor from "./validate-version.ts";
import validateSDKSetupExecutor from "./validate-sdk-setup.ts";
