import { healthcheck } from "./healthcheck";
import { scout } from "./scout";
import { draftPitch } from "./draftPitch";
import { sendPitch } from "./sendPitch";

export { healthcheck, scout, draftPitch, sendPitch };
export const functions = [healthcheck, scout, draftPitch, sendPitch];
