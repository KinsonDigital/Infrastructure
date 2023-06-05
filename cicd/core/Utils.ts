import { HttpStatusCodes } from "./Enums.ts";
import { ErrorModel } from "./Models/GraphQLModels/ErrorModel.ts";
import { RequestResponseModel } from "./Models/GraphQLModels/RequestResponseModel.ts";
import { IIssueModel } from "./Models/IIssueModel.ts";
import { IMilestoneModel } from "./Models/IMilestoneModel.ts";
import { IPullRequestModel } from "./Models/IPullRequestModel.ts";
import { IssueNotFound, MilestoneNotFound, PullRequestNotFound } from "./Types.ts";

/**
 * Provides utility functions.
 */
export class Utils {
    /**
     * Checks if the value is numeric.
     * @param value The value to check.
     * @returns True if the value is numeric, otherwise false.
     */
    public static isNumeric(value: string): boolean {
        const parsedValue = parseFloat(value);

        return !isNaN(parsedValue) && isFinite(parsedValue) && value === parsedValue.toString();
    }

    /**
     * Prints the lines of text in a GitHub group.
     * @param lines The lines of text to print.
     */
    public static printInGroup(title: string, lines: string[]): void {
        console.log(`::group::${title}`);

        lines.forEach(line => {
            console.log(line);
        });

        console.log("::endgroup::");
    }

    /**
     * Checks if the value is null, undefined, or empty.
     * @param value The value to check.
     * @returns True if the value is null, undefined, or empty, otherwise false.
     */
    public static isNullOrEmptyOrUndefined(value: string | undefined | null): value is null | undefined | "" {
        return this.isNullOrUndefined(value) || value === "";
    }

    /**
     * Checks if the value is null or undefined.
     * @param value The value to check.
     * @returns True if the value is null or undefined, otherwise false.
     */
    public static isNullOrUndefined(value: any): value is null | undefined {
        return value === undefined || value === null;
    }

    /**
     * Gets the name of the script that is running.
     * @returns The name of the script that is running.
     */
    public static getScriptName(): string {
        return Deno.mainModule.substring(Deno.mainModule.lastIndexOf("/") + 1);
    }

    /**
     * Filters the given list of issues or pull requests to only return issues.
     * @param issuesOrPrs The issues or pull requests to filter.
     * @returns The issues from the given list of issues or pull requests.
     */
    public static filterIssues(issuesOrPrs: (IIssueModel | IPullRequestModel)[]): IIssueModel[] {
        return <IIssueModel[]>issuesOrPrs.filter((item) => !("pull_request" in item));
    }

    /**
     * Filters the given list of issues or pull requests to only return pull requests.
     * @param issuesOrPrs The issues or pull requests to filter.
     * @returns The pull requests from the given list of issues or pull requests.
     */
    public static filterPullRequests(issuesOrPrs: (IIssueModel | IPullRequestModel)[]): IPullRequestModel[] {
        return <IPullRequestModel[]>issuesOrPrs.filter((item) => "pull_request" in item);
    }

    /**
     * Prints the given message as a GitHub error.
     * @param message The message to print.
     */
    public static printAsGitHubError(message: string): void {
        console.log(`:error::${message}`);
    }

    /**
     * Prints the given list of problems as errors.
     * @param problems The list of problems to print.
     * @returns A promise that resolves if there are no problems, otherwise rejects with the list of problems.
     */
    public static async printProblemList(problems: string[]): Promise<void> {
        let errorList: string[] = [];

        // Display all of the issues that have been found as errors
        for (let i = 0; i < problems.length; i++) {
            const errorFound = problems[i];
        
            errorList.push(`${i + 1}. ${errorFound}`);
        }
        
        return new Promise((resolve, reject) => {
            if (problems.length > 0) {
                reject(`::error::${errorList.join("\n")}`);
            } else {
                resolve();
            }
        });
    }

    /**
	 * Checks if the response contains status codes other than in the 200 range.
     * If it does, it will print the error message and exit the process.
	 * @param response The response from a request.
	 */
	public static throwIfErrors(response: Response): void {
		if (response.status < HttpStatusCodes.OK) {
			const errorMsg =
				`There was a problem with the request. Status code: ${response.status}(${response.statusText}).`;

			Utils.printAsGitHubError(errorMsg);
            Deno.exit(1);
		}
	}

    /**
     * Checks if the given {@link issue} exists.
     * @param issue The issue to check.
     * @returns True if the issue exists, otherwise false.
     */
    public static issueExists(issue: any): issue is IIssueModel | boolean {
        const objKeys: string[] = Object.keys(issue);        

        for (let i = 0; i < objKeys.length; i++) {
            const objKey = objKeys[i];
            
            if (!Object.hasOwn(issue, objKey)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Checks if the given {@link issue} is an instance of {@link IssueNotFound}.
     * @param issue The issue to check.
     * @returns True if the issue is an instance of {@link IssueNotFound}, otherwise false.
     */
    public static isIssueNotFound(issue: IIssueModel | IssueNotFound): issue is IssueNotFound {
        return typeof issue === "object" && issue !== null && "statusCode" in issue && "statusText" in issue;
    }

    /**
     * Checks if the given {@link issue} is an instance of {@link PullRequestNotFound}.
     * @param issue The pull request to check.
     * @returns True if the pull request is an instance of {@link PullRequestNotFound}, otherwise false.
     */
    public static isPullRequestNotFound(issue: IPullRequestModel | PullRequestNotFound): issue is PullRequestNotFound {
        return typeof issue === "object" && issue !== null && "statusCode" in issue && "statusText" in issue;
    }

    /**
     * Checks if the given {@link issue} is an instance of {@link IssueNotFound}.
     * @param issue The issue to check.
     * @returns True if the issue is an instance of {@link IssueNotFound}, otherwise false.
     */
    public static isMilestoneNotFound(issue: IMilestoneModel | MilestoneNotFound): issue is MilestoneNotFound {
        return typeof issue === "object" && issue !== null && "statusCode" in issue && "statusText" in issue;
    }
}
