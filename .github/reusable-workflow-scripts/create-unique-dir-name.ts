/**
 * DESCRIPTION:
 * Create a unique path for the caller repository calling the 'validate-release.yml' workflow.
 */

import { setGitHubOutput } from "../../cicd/core/github.ts";

const callerRepoPrefix = (Deno.env.get("CALLER_REPO_NAME") ?? "").trim();

if (callerRepoPrefix === "") {
	console.log("::error::Missing required environment variable: CALLER_REPO_NAME");

	Deno.exit(1);
}

const guid = crypto.randomUUID().split("-")[0];

try {
	setGitHubOutput("unique-dir-name", `${callerRepoPrefix}-${guid}`);
} catch (error) {
	const errorMsg = error instanceof Error ? error.message : "Unknown error";
	console.log(`::error::${errorMsg}`);

	Deno.exit(1);
}	
