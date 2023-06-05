import { IssueClient } from "../core/IssueClient.ts";
import { IIssueModel } from "../core/Models/IIssueModel.ts";
import { IPullRequestModel } from "../core/Models/IPullRequestModel.ts";
import { ProjectClient } from "../core/ProjectClient.ts";
import { PullRequestClient } from "../core/PullRequestClient.ts";
import { ScriptDescriptions } from "../core/ScriptDescriptions.ts";
import { Utils } from "../core/Utils.ts";
import { IssueNotFound, PullRequestNotFound } from "../core/Types.ts";

const scriptName = Utils.getScriptName();
const scriptDescriptions: ScriptDescriptions = new ScriptDescriptions();
scriptDescriptions.printScriptDescription(scriptName);

if (Deno.args.length != 5) {
    let errorMsg = `The '${scriptName}' cicd script must have at least 3 arguments with an additional 2 optional arguments.`;
    errorMsg += "\nThe 1st arg is required and must be the GitHub repo name.";
    errorMsg += "\nThe 2nd arg is required and must be a valid issue or pull request number.";
    errorMsg += "\nThe 3rd arg is required and must be a either the value 'issue' or pr' for the item type.";
    errorMsg += "\nThe 4th arg is required and must be a valid GitHub organization project.";
    errorMsg += "\nThe 5th arg is required and must be a valid GitHub token.";

    Utils.printAsGitHubError(`${errorMsg}`);
    Deno.exit(1);
}

const repoName = Deno.args[0].trim();
const issueOrPRNumber: number = Utils.isNumeric(Deno.args[1].trim()) ? parseInt(Deno.args[1].trim()) : -1;
const itemType: string = Deno.args[2].trim().toLowerCase();
const projectName: string = Deno.args[3].trim();
const token = Deno.args[4].trim();

const numberInvalid: boolean = issueOrPRNumber <= 0;

const doesNotExistErrorMsg = `The issue or PR number '${issueOrPRNumber}' does not exist in the '${repoName}' repo.`;

if (numberInvalid) {
    Utils.printAsGitHubError(doesNotExistErrorMsg);
    Deno.exit(1);
}

let itemNodeId: string = "";

switch (itemType) {
    case "issue":
        const issueClient: IssueClient = new IssueClient(token);
        const issue: IIssueModel | IssueNotFound = await issueClient.getIssue(repoName, issueOrPRNumber);
        
        if (Utils.isIssueNotFound(issue)) {
            Utils.printAsGitHubError(doesNotExistErrorMsg);
            Deno.exit(1);
        }

        itemNodeId = issue.node_id;

        break;
    case "pr":
        const prClient: PullRequestClient = new PullRequestClient(token);
        const pr: IPullRequestModel | PullRequestNotFound = await prClient.getPullRequest(repoName, issueOrPRNumber);
        
        if (Utils.isPullRequestNotFound(pr)) {
            Utils.printAsGitHubError(doesNotExistErrorMsg);
            Deno.exit(1);
        }

        itemNodeId = pr.node_id;

        break;
    default:
        Utils.printAsGitHubError(`The item type '${itemType}' is invalid. It must be a value of 'issue' or 'pr'.`);
        break;
}

const projectClient: ProjectClient = new ProjectClient(token);

const projectDoesNotExist: boolean = !(await projectClient.projectExists(projectName));

if (projectDoesNotExist) {
    Utils.printAsGitHubError(`The organization project '${projectName}' does not exist.`);
    Deno.exit(1);
}

await projectClient.addToProject(itemNodeId, projectName);
