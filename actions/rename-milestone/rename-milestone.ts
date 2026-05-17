import { MilestoneClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.16/github";
import { getEnvVar } from "../../cicd/core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const githubToken = getEnvVar("EA_CICD_TOKEN", scriptFileName);
const currentMilestoneName = getEnvVar("CURRENT_MILESTONE_NAME", scriptFileName);
const newMilestoneName = getEnvVar("NEW_MILESTONE_NAME", scriptFileName);

const milestoneClient = new MilestoneClient(ownerName, repoName, githubToken);
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
	console.error(`Error: ${response.status} ${response.statusText}`);
	Deno.exit(1);
}
