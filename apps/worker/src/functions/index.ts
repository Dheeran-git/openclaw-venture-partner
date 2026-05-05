import { healthcheck } from "./healthcheck";
import { scout } from "./scout";
import { draftPitch } from "./draftPitch";

export { healthcheck, scout, draftPitch };
export const functions = [healthcheck, scout, draftPitch];
