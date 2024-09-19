import getEnvVar from "../core/GetEnvVar.ts";
import { validateMilestoneExists, validateRepoExists } from "../core/Validators.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const milestoneTitle = getEnvVar("MILESTONE_TITLE", scriptFileName);

await validateRepoExists(scriptFileName);
await validateMilestoneExists(milestoneTitle, scriptFileName);
