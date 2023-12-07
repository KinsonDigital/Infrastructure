import { ResolveCsProjRunner } from "./runners/ResolveCsProjRunner.ts";

const resolveCsProjExecutor: ResolveCsProjRunner = new ResolveCsProjRunner(Deno.args);
await resolveCsProjExecutor.run();

export default resolveCsProjExecutor;
