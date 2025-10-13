import { ValidateSDKVersionService } from "../core/Services/ValidateSDKVersionService.ts";
import { getEnvVar } from "../core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const baseSearchDirPath = getEnvVar("BASE_SEARCH_DIR_PATH", scriptFileName);
const dotnetSdkVersion = getEnvVar("NET_SDK_VERSION", scriptFileName);

const validator = new ValidateSDKVersionService();
validator.validate(baseSearchDirPath, dotnetSdkVersion);
