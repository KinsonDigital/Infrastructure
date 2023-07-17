import { UpdateCSharpProjRunner } from "./runners/UpdateCSharpProjRunner.ts";

const runner = new UpdateCSharpProjRunner(Deno.args);

await runner.run();
