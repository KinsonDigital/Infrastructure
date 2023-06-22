import { createOrgProjectsQuery } from "../core/GraphQLQueries/GetOrgProjectsQueries.ts";
import { RequestResponseModel } from "../core/Models/GraphQLModels/RequestResponseModel.ts";
import { IProjectModel } from "../core/Models/IProjectModel.ts";
import { GraphQLClient } from "../core/GraphQLClient.ts";
import { Guard } from "../core/Guard.ts";
import { Utils } from "../core/Utils.ts";
import { createLinkItemToProjectMutation } from "../core/GraphQLMutations/AddToProjectMutation.ts";
import { createGetIssueProjectsQuery } from "../core/GraphQLQueries/GetIssueProjectsQuery.ts";

/**
 * Gets or saves data related to GitHub organization projects.
 * @remarks This client requires authentication for all requests.
 */
export class ProjectClient extends GraphQLClient {
	/**
	 * Initializes a new instance of the {@link ProjectClient} class.
	 * @param token The GitHub token.
	 */
	constructor(token: string) {
		super(token);
	}

	/**
	 * Gets a list of the GitHub organization projects.
	 * @returns The list of projects.
	 */
	public async getOrgProjects(): Promise<IProjectModel[]> {
		const query = createOrgProjectsQuery(this.organization);
		const response = await this.fetchPOST(query);

		const responseData: RequestResponseModel = await this.getResponseData(response);

		return <IProjectModel[]> responseData.data.organization.projectsV2.nodes;
	}

	/**
	 * Returns a value indicating whether or not the project exists with the given {@link projectName}.
	 * @param projectName The name of the project.
	 * @returns True if the project exists, otherwise false.
	 */
	public async projectExists(projectName: string): Promise<boolean> {
		Guard.isNullOrEmptyOrUndefined(projectName, "projectExists");

		projectName = projectName.trim();
		const projects = await this.getOrgProjects();

		return projects.some((project) => project.title === projectName);
	}

	/**
	 * Adds an issue or pull request with the given {@link contentId} to a project with the given {@link projectName}.
	 * @param contentId The node id of an issue or pull request.
	 * @param projectName The name of the project.
	 * @throws Throws an error if the project does not exist.
	 */
	public async addToProject(contentId: string, projectName: string): Promise<void> {
		const funcName = "addToProject";
		Guard.isNullOrEmptyOrUndefined(contentId, funcName);
		Guard.isNullOrEmptyOrUndefined(projectName, funcName);

		contentId = contentId.trim();
		projectName = projectName.trim();

		const projects = await this.getOrgProjects();

		const project: IProjectModel | undefined = projects.find((project) => project.title.trim() === projectName);

		if (project === undefined) {
			Utils.printAsGitHubError(`The project '${projectName}' does not exist.`);
			Deno.exit(1);
		}

		const query = createLinkItemToProjectMutation(contentId, project.id);
		const response = await this.fetchPOST(query);

		Utils.throwIfErrors(response);
	}

	/**
	 * Gets a list of the organizational projects for an issue that has the given {@link issueNumber},
	 * in a repository with a name that matches the given {@link repoName}.
	 * @param repoName The name of the repository.
	 * @param issueNumber The issue number.
	 * @returns The list of organizational projects that the issue is assigned to.
	 */
	public async getIssueProjects(repoName: string, issueNumber: number): Promise<IProjectModel[]> {
		const funcName = "getIssueProjects";
		Guard.isNullOrEmptyOrUndefined(repoName, funcName);
		Guard.isLessThanOne(issueNumber, funcName);

		repoName = repoName.trim();

		const query = createGetIssueProjectsQuery(this.organization, repoName, issueNumber);
		const response = await this.fetchPOST(query);

		const responseData: RequestResponseModel = await this.getResponseData(response);

		return <IProjectModel[]> responseData.data.repository.issue.projectsV2.nodes;
	}
}
