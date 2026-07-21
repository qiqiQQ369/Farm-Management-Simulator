import { MeshMerge } from "./mesh-merge";
import { MeshSubSplit } from "./mesh-sub-split";
import { MeshTerrain } from "./mesh-terrain";
import { MeshUV } from "./mesh-uv";

const { director, Vec3, MeshRenderer, Terrain, utils, Mat4, gfx } = require('cc');
/**
 * 杨宗宝 2024/4/7
 * 网格插件管理类
 */
export class MeshMgr {
    /**
     * 设置为单例类
     */
    private static _instance: MeshMgr = null!;
    public static get instance() {
        if (!this._instance) {
            this._instance = new MeshMgr();
        }
        return this._instance;
    }
    public async mergeNodesMesh(str: string): Promise<void> {
        let data: any = JSON.parse(str);

        let megerDatas: any[] = data.data;
        let isWorld = data.isWorld;
        let isForce = data.isForce;
        let isObj = data.isObj;

        let renders: any[] = [];
        for (let i = 0; i < megerDatas.length; i++) {
            let { uuid, childs } = megerDatas[i];
            if (uuid.length <= 0) continue;
            let node: any = cce.Node.query(uuid);
            if (!node) continue;
            if (childs) {
                let meshRenderers: any[] = node.getComponentsInChildren(MeshRenderer);
                renders.push(...meshRenderers);
            } else {
                let meshRenderer: any = node.getComponent(MeshRenderer);
                if (meshRenderer) {
                    renders.push(meshRenderer)
                }
            }
        }
        if (renders.length <= 0) {
            console.warn("杨宗宝：已绑定节点未查询到正确使用的MeshRenderer组件....");
            return;
        }
        await MeshMerge.merge("carlosyzy", renders, isWorld, isObj, isForce);
    }
    public async analysisSplitSubMesh(uuid: string): Promise<string> {
        let node: any = cce.Node.query(uuid);
        if (!node) {
            console.warn("杨宗宝：请先绑定正确的渲染节点....");
            return "0";
        }
        let meshRenderer: any = node.getComponent(MeshRenderer);
        if (!meshRenderer) {
            console.warn("杨宗宝：已绑定节点未查询到正确使用的MeshRenderer组件....");
            return "0";
        }
        let mesh: any = meshRenderer.mesh;
        let struct: any = mesh.struct;
        let primitives: any[] = struct.primitives;
        return primitives.length + "";
    }
    public async splitSubMeshs(uuid: string, str: string): Promise<void> {
        console.log("杨宗宝：开始拆分....");
        let node: any = cce.Node.query(uuid);
        if (!node) {
            console.warn("杨宗宝：请先绑定正确的渲染节点....");
            return;
        }
        let data: any = JSON.parse(str);
        let splitDatas: any[] = data.data;
        let isWorld = data.isWorld;
        let isObj = data.isObj;
        await MeshSubSplit.split(node, splitDatas, isWorld, isObj);
    }
    public async convertTerrainToMesh(str: string) {
        let data: any = JSON.parse(str);
        let terrainDatas: any[] = data.data;
        let isWorld = data.isWorld;
        let isMerge =false;
        let isObj = data.isObj;

        let renders: any[] = [];
        for (let i = 0; i < terrainDatas.length; i++) {
            let { uuid } = terrainDatas[i];
            if (uuid.length <= 0) continue;
            let node: any = cce.Node.query(uuid);
            if (!node) continue;
            let terrain: any = node.getComponent(Terrain);
            if (terrain) {
                renders.push(terrain)
            }
        }
        if (renders.length <= 0) return;
        MeshTerrain.terrain("carlosyzy",renders, isWorld, isMerge, isObj);

    }
    public  async getUVDatas(uuid: string) {
        return MeshUV.getMeshUv(uuid);
    }

}