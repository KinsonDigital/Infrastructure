/**
 * Various settings for generating release notes.
 */
export interface GeneratorSettings {
	/**
	 * The owner name of the GitHub repository.
	 * This is the username or organization name that owns the repository.
	 */
	ownerName: string;

	/**
	 * The name of the GitHub repository.
	 * This should be the exact repository name as it appears on GitHub.
	 */
	repoName: string;

	/**
	 * The name of the environment variable that contains the GitHub token.
	 * This token is used to authenticate API requests to GitHub.
	 */
	githubTokenEnvVarName: string;

	/**
	 * The name of the milestone to generate release notes for.
	 * Can use placeholders like '${VERSION}' which will be replaced at runtime.
	 */
	milestoneName: string;

	/**
	 * The header text that appears at the top of the release notes.
	 * Can use placeholders like '${REPONAME}', '${RELEASETYPE}', and '${VERSION}'.
	 */
	headerText: string;

	/**
	 * A mapping of words or phrases to replace in issue and PR titles.
	 * The key is the text to find and the value is the replacement text.
	 */
	wordReplacements: Record<string, string>;

	/**
	 * The type of release being generated (Ex: "Preview", "Production").
	 * This value is selected from the 'releaseTypeNames' array during tool execution.
	 */
	chosenReleaseType: string;

	/**
	 * An array of possible release type names that can be selected.
	 * These are presented as options when running the release notes generator tool.
	 */
	releaseTypeNames: string[];

	/**
	 * The relative path from the working directory where tool is executed.
	 * The tool will create a sub folder based on the release type within this path.
	 * Ex: If the relative dir path is 'release-notes/', and the release type is 'Preview',
	 * the final path will be 'release-notes/preview-releases'.
	 */
	relativeReleaseNotesDirPath: string;

	/**
	 * (Optional) The version number for the release (Ex: "v1.0.0", "v1.0.0-preview.1").
	 * This is provided at runtime when the tool is executed.
	 */
	version?: string;

	/**
	 * (Optional) extra information to include at the top of the release notes.
	 * Contains a title and text that will be displayed below the main header.
	 */
	extraInfo?: { title: string; text: string };

	/**
	 * (Optional) An array of emoji characters to remove from issue and PR titles.
	 */
	emojisToRemoveFromTitle?: string[];

	/**
	 * (Optional) A mapping of categories based on issue types for organizing content.
	 * Used to group issues by their type (Ex: "Bug Fixes", "New Features").
	 */
	issueCategoryIssueTypeMappings?: Record<string, string>;

	/**
	 * (Optional) A mapping of categories based on issue labels for organizing content.
	 * Issues with matching labels will be grouped under the specified category.
	 */
	issueCategoryLabelMappings?: Record<string, string>;

	/**
	 * (Optional) A mapping of categories based on pull request labels for organizing content.
	 * Pull requests with matching labels will be grouped under the specified category.
	 */
	prCategoryLabelMappings?: Record<string, string>;

	/**
	 * (Optional) An array of GitHub label names to ignore when generating release notes.
	 * Issues and PRs with these labels will be excluded from the generated notes.
	 */
	ignoreLabels?: string[];

	/**
	 * (Optional) A mapping of words to replace in issue titles.
	 * Used to standardize the beginning of issue and PR titles (Ex: "Add" -> "Added").
	 */
	firstWordReplacements?: Record<string, string>;

	/**
	 * (Optional) A mapping of words to apply specific styling or formatting.
	 * Used for consistent styling of certain terms throughout the release notes.
	 */
	styleWordsList?: Record<string, string>;

	/**
	 * (Optional) Whether to format version numbers in bold in the release notes.
	 * When true, version numbers will be wrapped in markdown bold formatting.
	 */
	boldedVersions?: boolean;

	/**
	 * (Optional) Whether to format version numbers in italics in the release notes.
	 * When true, version numbers will be wrapped in markdown italic formatting.
	 */
	italicVersions?: boolean;

	/**
	 * (Optional) The name of the category for issues and PRs that don't match any other category.
	 * If undefined, uncategorized items will not be included in the release notes.
	 */
	otherCategoryName?: string;
}
