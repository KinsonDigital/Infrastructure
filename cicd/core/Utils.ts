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
}
