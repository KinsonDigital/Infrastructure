/**
 * A class that contains functions to check if values are invalid.
 */
export class Guard {
    /**
     * Checks if the value is null, undefined, or empty.
     * @param value The value to check.
     * @returns True if the value is null, undefined, or empty, otherwise false.
     */
    public static isNullOrEmptyOrUndefined(value: string | undefined | null, funcName: string = "", paramName: string = ""): void {
        if (value === undefined || value === null || value === "") {
            console.log("::error::The value is null, undefined, or empty.");

            if (funcName != "") {
                console.log(`Function Name: ${funcName}`);
            }

            if (paramName != "") {
                console.log(`Param Name: ${paramName}`);
            }

            Deno.exit(1);
        }
    }

    // Create a function that checks if a number is undefined, null, Nan, Infinite, or -Infinity, or negative
    public static isLessThanOne(value: number | undefined | null, funcName: string = "", paramName: string = ""): void {
        if (value === undefined || value === null || isNaN(value) || !isFinite(value)) {
            console.log("::error::The value is undefined, null, NaN, Infinite, -Infinity.");

            if (funcName != "") {
                console.log(`Function Name: ${funcName}`);
            }

            if (paramName != "") {
                console.log(`Param Name: ${paramName}`);
            }

            Deno.exit(1);
        }

        if (value < 0) {
            console.log("::error::The value is less than or equal to zero.");

            if (funcName != "") {
                console.log(`Function Name: ${funcName}`);
            }

            if (paramName != "") {
                console.log(`Param Name: ${paramName}`);
            }

            Deno.exit(1);
        }
    }
}