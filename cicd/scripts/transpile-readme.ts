import { TranspileReadMeRunner } from "./runners/TranspileReadMeRunner.ts";

const runner: TranspileReadMeRunner = new TranspileReadMeRunner(Deno.args);

await runner.run();
