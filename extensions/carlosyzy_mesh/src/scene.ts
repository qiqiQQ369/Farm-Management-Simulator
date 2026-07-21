import { MeshMgr } from "./mesh-mgr";

export function load() { };
export function unload() { };
export const methods = {
  async mergeNodesMesh(data: string) {
    await MeshMgr.instance.mergeNodesMesh(data);
  },
  async analysisSplitSubMesh(uuid: string) {
    return MeshMgr.instance.analysisSplitSubMesh(uuid);
  },
  async splitSubMeshs(uuid: string, data: string) {
    await MeshMgr.instance.splitSubMeshs(uuid, data);
  },
  async convertTerrainToMesh(data: string) {
    await MeshMgr.instance.convertTerrainToMesh(data);
  },
  async getUVDatas(uuid:string){
    return MeshMgr.instance.getUVDatas(uuid);
  }
};