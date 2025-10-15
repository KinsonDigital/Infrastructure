import { printAsGitHubError } from "./github.ts";

/**
 * JSR meta data model from calling the 'https://jsr.io/@${scope}/${pkgName}/meta.json' API endpoint.
 */
export interface JsrMetaModel {
	/**
	 * Gets the scope of the package.
	 */
	scope: string;

	/**
	 * Gets the name of the package
	 */
	name: string;

	/**
	 * Gets the latest production version of the package.
	 */
	latest: string | null;

	/**
	 * Gets the versions of the package.
	 */
	versions: {
		"1.0.0-preview.14": Record<string | number | symbol, never>;
		"1.0.0-preview.13": Record<string | number | symbol, never>;
	};
}

/**
 * Gets the meta data for a package with the given {@link scope} and {@link pkgName}.
 * @param scope The scope of the package.
 * @param pkgName The name of the package.
 */
export default async function getJsrPkgMetaData(scope: string, pkgName: string): Promise<string[]> {
	scope = scope.toLowerCase();
	pkgName = pkgName.toLowerCase();

	const url = `https://jsr.io/@${scope}/${pkgName}/meta.json`;

	const response = await fetch(url);

	if (response.status !== 200) {
		if (response.status === 404) {
			return [];
		} else {
			const errorMsg = `An error occurred while fetching the meta data for the package '@${scope}/${pkgName}'.` +
				`\n${response.status} - ${response.statusText}`;

			printAsGitHubError(errorMsg);
			Deno.exit();
		}
	}

	const metaData = await response.json() as JsrMetaModel;

	const versions = Object.keys(metaData.versions);

	return versions;
}
