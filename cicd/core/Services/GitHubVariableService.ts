import { OrgClient } from "../../clients/OrgClient.ts";
import { RepoClient } from "../../clients/RepoClient.ts";
import { Guard } from "../Guard.ts";
import { GitHubVarModel } from "../Models/GitHubVarModel.ts";

/**
 * Provides a service for interacting with GitHub organization or repository variables.
 */
export class GitHubVariableService {
	private readonly orgClient: OrgClient;
	private readonly repoClient: RepoClient;
	private readonly cachedVars: GitHubVarModel[] = [];
	private orgName?: string;
	private repoName?: string;

	/**
	 * Initializes a new instance of the {@link GitHubVariableService} class.
	 * @param token The token to use for authentication.
	 * @param orgName The name of the organization.
	 * @param repoName The name of the repository.
	 */
	constructor(token: string, orgName?: string, repoName?: string) {
		const funcName = "setOrgAndRepo";
		Guard.isNullOrEmptyOrUndefined(token, funcName, "token");

		this.repoName = repoName;
		this.orgName = orgName;
		this.orgClient = new OrgClient(token);
		this.repoClient = new RepoClient(token);
	}

	/**
	 * Sets the name of the organization and repository.
	 * @param orgName The name of the organization.
	 * @param repoName The name of the repository.
	 */
	public setOrgAndRepo(orgName: string, repoName: string): void {
		const funcName = "setOrgAndRepo";
		Guard.isNullOrEmptyOrUndefined(orgName, funcName, "orgName");
		Guard.isNullOrEmptyOrUndefined(repoName, funcName, "repoName");

		this.orgName = orgName;
		this.repoName = repoName;
	}

	/**
	 * Gets the value of the variable with a name that matches the given {@link name}.
	 * @param name The name of the variable.
	 * @param throwErrorWhenNotFound True to reject the promise when the variable is not found.
	 * @returns The value of the variable.
	 * @remarks If the {@link throwErrorWhenNotFound} value is false and the variable is not found,
	 * an empty string will be returned.
	 */
	public async getValue(name: string, throwErrorWhenNotFound = true): Promise<string> {
		const variable = await this.getVar(name);

		return new Promise<string>((resolve, reject) => {
			if (throwErrorWhenNotFound && variable === undefined) {
				reject(`The variable '${name}' was not found.`);
			} else {
				resolve(variable === undefined ? "" : variable.value.trim());
			}
		});
	}

	/**
	 * Gets a value indicating whether or not a variable with a name that matches the given {@link name} exists.
	 * @param name The name of the variable.
	 * @returns True if the variable exists; otherwise, false.
	 */
	public async varExists(name: string): Promise<boolean> {
		const variable = await this.getVar(name);

		if (variable === undefined) {
			return false;
		} else {
			return true;
		}
	}

	/**
	 * Gets a value indicating whether or not all of the given variable {@link names} exist.
	 * @param names The list of variable names.
	 * @returns A tuple containing a value indicating whether or not all of the variables
	 * exist and a list of the non-existing variables.
	 */
	public async allVarsExist(names: string[]): Promise<[boolean, string[]]> {
		const nonExistingVars: string[] = [];

		for (let i = 0; i < names.length; i++) {
			const name = names[i];

			if ((await this.getVar(name)) === undefined) {
				nonExistingVars.push(name);
			}
		}

		return [nonExistingVars.length <= 0, nonExistingVars];
	}

	/**
	 * Gets a variable with a name that matches the given {@link name}.
	 * @param name The name of the variable.
	 * @returns The variable.
	 * @remarks The variables are cached to reduce requests to GitHub.
	 */
	private async getVar(name: string): Promise<GitHubVarModel | undefined> {
		const funcName = "getVar";
		Guard.isNullOrEmptyOrUndefined(this.orgName, funcName, "GitHubVariableService.orgName");
		Guard.isNullOrEmptyOrUndefined(this.repoName, funcName, "GitHubVariableService.repoName");

		if (this.cachedVars.length === 0) {
			const orgVars = await this.orgClient.getVariables(this.orgName!);
			const repoVars = await this.repoClient.getVariables(this.repoName!);

			const orgVarsToKeep = orgVars.filter((orgVar) => {
				return !repoVars.some((repoVar) => repoVar.name === orgVar.name);
			});

			this.cachedVars.push(...orgVarsToKeep);
			this.cachedVars.push(...repoVars);
		}

		return this.cachedVars.find((v) => v.name === name);
	}
}
