import { IIssueModel } from "./Models/IIssueModel.ts";
import { IPullRequestModel } from "./Models/IPullRequestModel.ts";

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
     * Gets the data from an HTTP response.
     * @param response The HTTP response to get the data from.
     * @returns The data from the response.
     */
    public static async getResponseData(response: Response): Promise<any> {
        const responseText: string = await response.text();

        return await JSON.parse(responseText);
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
    public static filterIssues(issuesOrPrs: IIssueModel[] | IPullRequestModel[]): IIssueModel[] {
        return <IIssueModel[]>issuesOrPrs.filter((item) => !("pull_request" in item));
    }

    /**
     * Filters the given list of issues or pull requests to only return pull requests.
     * @param issuesOrPrs The issues or pull requests to filter.
     * @returns The pull requests from the given list of issues or pull requests.
     */
    public static filterPullRequests(issuesOrPrs: IIssueModel[] | IPullRequestModel[]): IPullRequestModel[] {
        return <IPullRequestModel[]>issuesOrPrs.filter((item) => "pull_request" in item);
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
}
