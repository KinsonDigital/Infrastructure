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
}
