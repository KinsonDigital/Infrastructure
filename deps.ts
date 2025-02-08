// Deno Standard Library
import { existsSync, walkSync } from "https://deno.land/std@0.207.0/fs/mod.ts";
import { basename, extname, resolve } from "https://deno.land/std@0.207.0/path/mod.ts";
import { isWindows } from "https://deno.land/std@0.207.0/path/_os.ts";

// KD CLIENTS
import {
	GitClient,
	IssueClient,
	LabelClient,
	MilestoneClient,
	OrgClient,
	ProjectClient,
	PullRequestClient,
	ReleaseClient,
	RepoClient,
	TagClient,
	UsersClient,
} from "https://deno.land/x/kd_clients@v1.0.0-preview.8/GitHubClients/mod.ts";
import { XClient } from "https://deno.land/x/kd_clients@v1.0.0-preview.8/OtherClients/mod.ts";
import { NuGetClient } from "https://deno.land/x/kd_clients@v1.0.0-preview.8/PackageClients/mod.ts";

import {
	GitHubVarModel,
	IssueModel,
	LabelModel,
	MilestoneModel,
	ProjectModel,
	PullRequestModel,
	UserModel,
} from "https://deno.land/x/kd_clients@v1.0.0-preview.8/core/Models/mod.ts";

// NPM PACKAGES
import chalk from "npm:chalk@5.3.0";

// LOCAL MODULES
import { CLI, Directory, File, Path } from "./cicd/core/mod.ts";

//////////////////////////////////////////////////////////////////////////////////////////////

// Deno Standard Library
export { existsSync, walkSync };
export { basename, extname, resolve };
export { isWindows };

// KD CLIENTS
export {
	GitClient,
	IssueClient,
	LabelClient,
	MilestoneClient,
	NuGetClient,
	OrgClient,
	ProjectClient,
	PullRequestClient,
	ReleaseClient,
	RepoClient,
	TagClient,
	UsersClient,
	XClient,
};
export type { GitHubVarModel, IssueModel, LabelModel, MilestoneModel, ProjectModel, PullRequestModel, UserModel };

// NPM PACKAGES
export default chalk;

// LOCAL MODULES
export { CLI, Directory, File, Path };
