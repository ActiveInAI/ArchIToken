declare module "three/examples/jsm/loaders/USDLoader.js" {
  import { Group, Loader, LoadingManager } from "three";

  export class USDLoader extends Loader<Group> {
    constructor(manager?: LoadingManager);
    parse(buffer: ArrayBuffer): Group;
  }
}
