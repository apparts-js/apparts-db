import { GenericQueriable } from "./GenericQueriable";

export abstract class GenericDBS extends GenericQueriable {
  abstract shutdown(): Promise<void>;
}
