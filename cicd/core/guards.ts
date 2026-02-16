/**
 * Returns a value indicating if the given {@link value} is undefined.
 * @param value The value to check.
 * @returns True if the value is undefined, otherwise false.
 */
export function isUndefined(value: unknown): value is undefined {
	return value === undefined;
}

/**
 * Returns a value indicating if the given {@link value} is not undefined.
 * @param value The value to check.
 * @returns True if the value is not undefined, otherwise false.
 */
export function isNotUndefined(value: unknown): value is undefined {
	return !isUndefined(value);
}

/**
 * Returns a value indicating if the given {@link value} is null.
 * @param value The value to check.
 * @returns True if the value is null, otherwise false.
 */
export function isNull(value: unknown): value is null {
	return value === null;
}

/**
 * Returns a value indicating if the given {@link value} is not null.
 * @param value The value to check.
 * @returns True if the value is not null, otherwise false.
 */
export function isNotNull(value: unknown): value is null {
	return !isNull(value);
}

/**
 * Returns a value indicating if the given {@link value} is an empty string or array.
 * @param value The value to check.
 * @returns True if the value is an empty string or array, otherwise false.
 */
export function isEmpty<T>(value: string | T[]): value is "" | [] {
	if (isString(value)) {
		return value === "";
	}

	return value.length === 0;
}

/**
 * Returns a value indicating if the given {@link value} is not an empty string or array.
 * @param value The value to check.
 * @returns True if the value is not an empty string or array, otherwise false.
 */
export function isNotEmpty<T>(value: string | T[]): value is "" | [] {
	return !isEmpty(value);
}

/**
 * Returns a value indicating if the given {@link value} is a function.
 * @param func The value to check.
 * @returns True if the value is a function, otherwise false.
 */
export function isFunction(func: unknown): func is (...args: unknown[]) => unknown {
	return typeof func === "function";
}

/**
 * Returns a value indicating if the given {@link value} is not a function.
 * @param func The value to check.
 * @returns True if the value is not a function, otherwise false.
 */
export function isNotFunction(func: unknown): func is (...args: unknown[]) => unknown {
	return !isFunction(func);
}

/**
 * Returns a value indicating if the given {@link value} is undefined or null.
 * @param value The value to check.
 * @returns True if the value is undefined or null, otherwise false.
 */
export function isUndefinedOrNull(value: unknown): value is undefined | null {
	return isUndefined(value) || isNull(value);
}

/**
 * Returns a value indicating if the given {@link value} is undefined, null, or an empty string or array.
 * @param value The value to check.
 * @returns True if the value is undefined, null, or an empty string or array, otherwise false.
 */
export function isUndefinedOrNullOrEmpty(value: unknown | string | []): value is undefined | null | "" {
	if (typeof value === "string") {
		return isEmpty(value);
	} else if (Array.isArray(value)) {
		return value.length === 0;
	}

	return isUndefinedOrNull(value);
}

/**
 * Returns a value indicating whether the value is null, undefined, or empty.
 * @param value The value to check.
 * @returns True if the value is null, undefined, or empty, otherwise false.
 * @remarks If the value is null, undefined, the value true will be returned.
 * If the value is a string, true will be returned if the string is empty.
 * If the value is a number, true will be returned if the number is NaN.
 * If the value is an array, true will be returned if the array is empty.
 */
export function isNothing<T>(
	value: unknown | undefined | null | string | number | boolean | T[],
): value is undefined | null | "" {
	if (value === undefined || value === null) {
		return true;
	}

	if (isString(value)) {
		return value === "";
	}

	if (typeof value === "number") {
		return isNaN(value);
	}

	if (Array.isArray(value)) {
		return value.length <= 0;
	}

	return false;
}

/**
 * Returns a value indicating whether the value is not null, undefined, or empty.
 * @param value The value to check.
 * @returns True if the value is not null, undefined, or empty, otherwise false.
 * @remarks If the value is not null, undefined, the value true will be returned.
 * If the value is a string, true will be returned if the string is not empty.
 * If the value is a number, true will be returned if the number is not NaN.
 * If the value is an array, true will be returned if the array is not empty.
 */
export function isNotNothing<T>(
	value: unknown | undefined | null | string | number | boolean | T[],
): value is undefined | null | "" {
	return !isNothing(value);
}

/**
 * Returns true if the given {@link value} is a string.
 * @param value The value to check.
 * @returns True if the value is a string.
 */
export function isString(value: unknown): value is string {
	return typeof value === "string";
}

/**
 * Returns a value indicating if the given {@link value} is not a string.
 * @param value The value to check.
 * @returns True if the value is not a string.
 */
export function isNotString(value: unknown): value is string {
	return !isString(value);
}

/**
 * Returns a value indicating if the given {@link value} is an error.
 * @param value The value to check.
 * @returns True if the value is an error.
 */
export function isError(value: unknown): value is Error {
	return value instanceof Error;
}

/**
 * Returns a value indicating if the given {@link value} is not an error.
 * @param value The value to check.
 * @returns True if the value is not an error.
 */
export function isNotError(value: unknown): value is Error {
	return !isError(value);
}

/**
 * Returns a value indicating whether or not the given {@link value} starts with a new line character.
 * @param value The value to check.
 * @returns True if the value starts with a new line character of '\n'.
 */
export function startsWithNL(value: string): value is string {
	if (isString(value)) {
		return value.startsWith("\n");
	}

	return false;
}

/**
 * Returns a value indicating whether or not the given {@link value} starts with a carriage return character.
 * @param value The value to check.
 * @returns True if the value starts with a carriage return character of '\r'.
 */
export function startsWithCR(value: string): value is string {
	if (isString(value)) {
		return value.startsWith("\r");
	}

	return false;
}

/**
 * Returns a value indicating whether or not the given {@link value} starts with a new line
 * character or a carriage return character.
 * @param value The value to check.
 * @returns True if the value starts with a new line character of '\n' or a carriage return character of '\r'.
 */
export function startsWithNLOrCR(value: string): value is string {
	if (isString(value)) {
		return startsWithNL(value) || startsWithCR(value);
	}

	return false;
}

/**
 * Returns a value indicating whether or not the given {@link value} ends with a new line character.
 * @param value The value to check.
 * @returns True if the value ends with a new line character of '\n'.
 */
export function endsWithNL(value: string): value is string {
	if (isString(value)) {
		return value.endsWith("\n");
	}

	return false;
}

/**
 * Returns a value indicating whether or not the given {@link value} ends with a carriage return character.
 * @param value The value to check.
 * @returns True if the value ends with a carriage return character of '\r'.
 */
export function endsWithCR(value: string): value is string {
	if (isString(value)) {
		return value.endsWith("\r");
	}

	return false;
}

/**
 * Returns a value indicating whether or not the given {@link value} ends with a new line
 * character or a carriage return character.
 * @param value The value to check.
 * @returns True if the value ends with a new line character of '\n' or a carriage return character of '\r'.
 */
export function endsWithNLOrCR(value: string): value is string {
	if (isString(value)) {
		return endsWithNL(value) || endsWithCR(value);
	}

	return false;
}

/**
 * Returns a value indicating whether the value is less than one.
 * @param value The value to check.
 */
export function isLessThanOne(value: undefined | null | number): value is undefined | null {
	if (isUndefinedOrNull(value) || isNaN(value) || !isFinite(value)) {
		return true;
	}

	if (value < 1) {
		return true;
	}

	return false;
}
