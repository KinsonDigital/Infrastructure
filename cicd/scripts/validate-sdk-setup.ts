import { ValidateSDKSetupRunner } from "./runners/ValidateSDKSetupRunner.ts";

const validateSDKSetupExecutor = async () => {
	const runner = new ValidateSDKSetupRunner(Deno.args);

	try {
		await runner.run();
	} catch (error) {
		console.error(error);
		Deno.exit(1);
	}
}

validateSDKSetupExecutor();

export default validateSDKSetupExecutor;
