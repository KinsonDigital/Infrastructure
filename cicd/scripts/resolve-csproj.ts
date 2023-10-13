import { ResolveCsProjRunner } from "./runners/ResolveCsProjRunner.ts";

const runner: ResolveCsProjRunner = new ResolveCsProjRunner(Deno.args);
await runner.run();
