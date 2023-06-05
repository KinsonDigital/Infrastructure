import { createOrgProjectsQuery } from "./GraphQLQueries/GetOrgProjectsQueries.ts";
import { RequestResponseModel } from "./Models/GraphQLModels/RequestResponseModel.ts";
import { IProjectModel } from "./Models/IProjectModel.ts";
import { GraphQLClient } from "./GraphQLClient.ts";
import { Guard } from "./Guard.ts";
import { Utils } from "./Utils.ts";
import { createLinkItemToProjectMutation } from "./GraphQLMutations/AddToProjectMutation.ts";

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
		const response = await this.fetch(query);

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
	 * Adds an issue or pull request with the given {@link nodeId} to the project with the given {@link projectName}.
	 * @param nodeId The node id of an issue or pull request.
	 * @param projectName The name of the project.
	 * @throws Throws an error if the project does not exist.
	 */
	public async addToProject(nodeId: string, projectName: string): Promise<void> {
		Guard.isNullOrEmptyOrUndefined(nodeId, "addToProject");
		Guard.isNullOrEmptyOrUndefined(projectName, "addToProject");

		nodeId = nodeId.trim();
		projectName = projectName.trim();

		const projects = await this.getOrgProjects();

		const project: IProjectModel | undefined = projects.find((project) => project.title.trim() === projectName);

		if (project === undefined) {
			Utils.printAsGitHubError(`The project '${projectName}' does not exist.`);
			Deno.exit(1);
		}

		const query = createLinkItemToProjectMutation(nodeId, project.id);
		const response = await this.fetch(query);

		Utils.throwIfErrors(response);
	}
}
