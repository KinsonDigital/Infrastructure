import { Utils } from "../core/Utils.ts";
import { ValidateReleaseNotesRunner } from "./runners/ValidateReleaseNotesRunner.ts";

const scriptName = Utils.getScriptName();

const scriptRunner: ValidateReleaseNotesRunner = new ValidateReleaseNotesRunner(Deno.args, scriptName);
scriptRunner.run();
