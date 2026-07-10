import { MilestoneClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.16/github";
import { getEnvVar } from "../../cicd/core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("REPO_OWNER", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const currentMilestoneName = getEnvVar("CURRENT_MILESTONE_NAME", scriptFileName);
const newMilestoneName = getEnvVar("NEW_MILESTONE_NAME", scriptFileName);
const githubToken = getEnvVar("GITHUB_TOKEN", scriptFileName);

const milestoneClient = new MilestoneClient(ownerName, repoName, githubToken);

const exists = await milestoneClient.exists(currentMilestoneName);

if (!exists) {
	console.error(`Milestone with name "${currentMilestoneName}" does not exist.`);
	Deno.exit(1);
}

const milestone = await milestoneClient.getMilestoneByName(currentMilestoneName);

const url = `https://api.github.com/repos/${ownerName}/${repoName}/milestones/${milestone.number}`;
const body = JSON.stringify({ title: newMilestoneName });

const response = await fetch(url, {
	method: "PATCH",
	headers: {
		"Accept": "application/vnd.github+json",
		"Authorization": `Bearer ${githubToken}`,
		"X-GitHub-Api-Version": "2022-11-28",
	},
	body,
});

if (!response.ok) {
	const responseBody = (await response.text()).trim();
	const details = responseBody.length > 0 ? ` - ${responseBody}` : "";

	console.error(`Error renaming milestone: ${response.status} ${response.statusText}${details}`);
	Deno.exit(1);
}
