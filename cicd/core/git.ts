/**
 * Gets the name of the currently checked out Git branch.
 * @returns A promise that resolves to the current branch name as a string,
 *          or an empty string if unable to determine the branch.
 */
export async function getCurrentBranch(): Promise<string> {
	const cmd = new Deno.Command("git", {
		args: ["symbolic-ref", "--short", "HEAD"],
	});

	const { stdout, stderr, success } = await cmd.output();

	let currentBranch = "";

	if (stdout) {
		currentBranch = new TextDecoder().decode(stdout).replace("\n", "");

		return currentBranch;
	}

	if (!success) {
		console.error(new TextDecoder().decode(stderr));
	}

	return "";
}

/**
 * Checks if the specified branch is currently checked out.
 *
 * @param branchName - The name of the branch to check
 * @returns A promise that resolves to true if the branch is checked out, false otherwise
 */
export async function isCheckedOut(branchName: string): Promise<boolean> {
	const currentCheckedOutBranch = await getCurrentBranch();

	return currentCheckedOutBranch === branchName;
}

/**
 * Checks out the specified Git branch.
 * @param branchName - The name of the branch to checkout
 * @returns A promise that resolves when the checkout operation is complete
 */
export async function checkoutBranch(branchName: string): Promise<void> {
	const cmd = new Deno.Command("git", {
		args: ["checkout", branchName],
	});

	const { stdout, stderr, success } = await cmd.output();

	if (stdout) {
		console.log(new TextDecoder().decode(stdout));
	}

	if (!success) {
		console.error(new TextDecoder().decode(stderr));
	}
}

/**
 * Creates a new branch and checks it out. If the branch already exists,
 * it will be reset to the current HEAD.
 * @param branchName - The name of the branch to create and checkout
 * @returns A promise that resolves when the operation is complete
 */
export async function createCheckoutBranch(branchName: string): Promise<void> {
	const cmd = new Deno.Command("git", {
		args: ["checkout", "-B", branchName],
	});

	const { stdout, stderr, success } = await cmd.output();

	if (stdout) {
		console.log(new TextDecoder().decode(stdout));
	}

	if (!success) {
		console.error(new TextDecoder().decode(stderr));
	}
}

/**
 * Stages all modified files in the repository for commit.
 * @returns A promise that resolves when all files are staged.
 *          Exits the process with code 1 if the operation fails.
 */
export async function stageAll(): Promise<void> {
	const cmd = new Deno.Command("git", {
		args: ["add", "*.*"],
	});

	const { stdout, stderr, success } = await cmd.output();

	if (success) {
		console.log(new TextDecoder().decode(stdout));
	}

	if (!success) {
		console.error(new TextDecoder().decode(stderr));
		Deno.exit(1);
	}
}

/**
 * Creates a Git commit with the specified message.
 * @param commitMsg - The commit message to use.
 * @returns A promise that resolves when the commit is created.
 *          Exits the process with code 0 on success or code 1 on failure.
 */
export async function createEmptyCommit(commitMsg: string): Promise<void> {
	const cmd = new Deno.Command("git", {
		args: ["commit", "--allow-empty", "-m", commitMsg],
	});

	const { stdout, stderr, success } = await cmd.output();

	if (stdout) {
		console.log(new TextDecoder().decode(stdout));
	}

	if (!success) {
		console.error(new TextDecoder().decode(stderr));
		Deno.exit(1);
	}
}

/**
 * Creates a Git commit with the specified message.
 * @param commitMsg - The commit message to use
 * @returns A promise that resolves when the commit is created.
 *          Exits the process with code 0 on success or code 1 on failure.
 */
export async function createCommit(commitMsg: string): Promise<void> {
	const cmd = new Deno.Command("git", {
		args: ["commit", "-m", commitMsg],
	});

	const { stdout, stderr, success } = await cmd.output();

	if (stdout) {
		console.log(new TextDecoder().decode(stdout));
	}

	if (!success) {
		console.error(new TextDecoder().decode(stderr));
		Deno.exit(1);
	}
}

/**
 * Checks if a branch exists locally in the repository.
 * @param branchName - The name of the branch to check for
 * @returns A promise that resolves to true if the branch exists locally, false otherwise.
 *          Exits the process with code 1 if the Git command fails.
 */
export async function branchExistsLocally(branchName: string): Promise<boolean> {
	const cmd = new Deno.Command("git", {
		args: ["branch", "--list"],
	});

	const { stdout, stderr, success } = await cmd.output();

	if (success) {
		const result = new TextDecoder().decode(stdout);

		const localBranches = result.split("\n")
			.map((b) => b.replace(/^\*/gm, "").trim())
			.filter((b) => b.length > 0);

		return localBranches.includes(branchName);
	}

	if (!success) {
		console.error(new TextDecoder().decode(stderr));
		Deno.exit(1);
	}

	return false;
}

/**
 * Checks if a branch exists on the remote repository (origin).
 * @param branchName - The name of the branch to check for on the remote
 * @returns A promise that resolves to true if the branch exists on remote, false otherwise.
 *          Exits the process with code 1 if the Git command fails.
 */
export async function branchExistsRemotely(branchName: string): Promise<boolean> {
	const cmd = new Deno.Command("git", {
		args: ["ls-remote", "--heads", "origin", branchName],
	});

	const { stdout, stderr, success } = await cmd.output();

	if (success) {
		const result = new TextDecoder().decode(stdout);
		const sections = result.split("\t").map((section) => section.trim().replaceAll("\n", ""));
		const branch = sections[1];

		return `refs/heads/${branchName}` === branch;
	}

	if (!success) {
		console.error(new TextDecoder().decode(stderr));
		Deno.exit(1);
	}

	return false;
}

/**
 * Pushes the specified branch to the remote repository (origin).
 * If the branch doesn't exist remotely, it will be created and set as upstream.
 * @param branchName - The name of the branch to push
 * @returns A promise that resolves when the push operation is complete.
 *          Exits the process with code 1 if the push fails.
 */
export async function pushToRemote(branchName: string): Promise<void> {
	const existsRemotely = await branchExistsRemotely(branchName);

	const args = existsRemotely ? ["push"] : ["push", "-u", "origin", branchName];

	const cmd = new Deno.Command("git", { args });

	const { stdout, stderr, success } = await cmd.output();

	if (success) {
		console.log(new TextDecoder().decode(stdout));
	}

	if (!success) {
		console.error(new TextDecoder().decode(stderr));
		Deno.exit(1);
	}
}
