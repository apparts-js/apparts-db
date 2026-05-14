import { GenericQueriable } from "./GenericQueriable";
import type { Capabilities } from "./types";

export abstract class GenericDBS extends GenericQueriable {
  abstract shutdown(): Promise<void>;
  abstract getCapabilities(): Capabilities;
}
