import { Utils } from "../core/Utils.ts";
import { GenerateReleaseNotesRunner } from "./runners/GenerateReleaseNotesRunner.ts";

const scriptName = Utils.getScriptName();

const runner: GenerateReleaseNotesRunner = new GenerateReleaseNotesRunner(Deno.args, scriptName);

await runner.run();
