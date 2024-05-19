import { TranspileReadMeRunner } from "./runners/TranspileReadMeRunner.ts";

const transpileReadMeExecutor: TranspileReadMeRunner = new TranspileReadMeRunner(Deno.args);
await transpileReadMeExecutor.run();

export default transpileReadMeExecutor;
