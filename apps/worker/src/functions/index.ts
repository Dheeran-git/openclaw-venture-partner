import { healthcheck } from "./healthcheck";
import { scout } from "./scout";
import { draftPitch } from "./draftPitch";
import { sendPitch } from "./sendPitch";
import { runLighthouseAudit } from "./runLighthouseAudit";
import { processInboundReply } from "./processInboundReply";
import { sendApprovedReply } from "./sendApprovedReply";
import { detectUpsells, detectUpsellsManual } from "./detectUpsells";

export {
  healthcheck,
  scout,
  draftPitch,
  sendPitch,
  runLighthouseAudit,
  processInboundReply,
  sendApprovedReply,
  detectUpsells,
  detectUpsellsManual,
};
export const functions = [
  healthcheck,
  scout,
  draftPitch,
  sendPitch,
  runLighthouseAudit,
  processInboundReply,
  sendApprovedReply,
  detectUpsells,
  detectUpsellsManual,
];
