"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeshMgr = void 0;
const mesh_merge_1 = require("./mesh-merge");
const mesh_sub_split_1 = require("./mesh-sub-split");
const mesh_terrain_1 = require("./mesh-terrain");
const mesh_uv_1 = require("./mesh-uv");
const { director, Vec3, MeshRenderer, Terrain, utils, Mat4, gfx } = require('cc');
/**
 * 杨宗宝 2024/4/7
 * 网格插件管理类
 */
class MeshMgr {
    static get instance() {
        if (!this._instance) {
            this._instance = new MeshMgr();
        }
        return this._instance;
    }
    async mergeNodesMesh(str) {
        let data = JSON.parse(str);
        let megerDatas = data.data;
        let isWorld = data.isWorld;
        let isForce = data.isForce;
        let isObj = data.isObj;
        let renders = [];
        for (let i = 0; i < megerDatas.length; i++) {
            let { uuid, childs } = megerDatas[i];
            if (uuid.length <= 0)
                continue;
            let node = cce.Node.query(uuid);
            if (!node)
                continue;
            if (childs) {
                let meshRenderers = node.getComponentsInChildren(MeshRenderer);
                renders.push(...meshRenderers);
            }
            else {
                let meshRenderer = node.getComponent(MeshRenderer);
                if (meshRenderer) {
                    renders.push(meshRenderer);
                }
            }
        }
        if (renders.length <= 0) {
            console.warn("杨宗宝：已绑定节点未查询到正确使用的MeshRenderer组件....");
            return;
        }
        await mesh_merge_1.MeshMerge.merge("carlosyzy", renders, isWorld, isObj, isForce);
    }
    async analysisSplitSubMesh(uuid) {
        let node = cce.Node.query(uuid);
        if (!node) {
            console.warn("杨宗宝：请先绑定正确的渲染节点....");
            return "0";
        }
        let meshRenderer = node.getComponent(MeshRenderer);
        if (!meshRenderer) {
            console.warn("杨宗宝：已绑定节点未查询到正确使用的MeshRenderer组件....");
            return "0";
        }
        let mesh = meshRenderer.mesh;
        let struct = mesh.struct;
        let primitives = struct.primitives;
        return primitives.length + "";
    }
    async splitSubMeshs(uuid, str) {
        console.log("杨宗宝：开始拆分....");
        let node = cce.Node.query(uuid);
        if (!node) {
            console.warn("杨宗宝：请先绑定正确的渲染节点....");
            return;
        }
        let data = JSON.parse(str);
        let splitDatas = data.data;
        let isWorld = data.isWorld;
        let isObj = data.isObj;
        await mesh_sub_split_1.MeshSubSplit.split(node, splitDatas, isWorld, isObj);
    }
    async convertTerrainToMesh(str) {
        let data = JSON.parse(str);
        let terrainDatas = data.data;
        let isWorld = data.isWorld;
        let isMerge = false;
        let isObj = data.isObj;
        let renders = [];
        for (let i = 0; i < terrainDatas.length; i++) {
            let { uuid } = terrainDatas[i];
            if (uuid.length <= 0)
                continue;
            let node = cce.Node.query(uuid);
            if (!node)
                continue;
            let terrain = node.getComponent(Terrain);
            if (terrain) {
                renders.push(terrain);
            }
        }
        if (renders.length <= 0)
            return;
        mesh_terrain_1.MeshTerrain.terrain("carlosyzy", renders, isWorld, isMerge, isObj);
    }
    async getUVDatas(uuid) {
        return mesh_uv_1.MeshUV.getMeshUv(uuid);
    }
}
exports.MeshMgr = MeshMgr;
/**
 * 设置为单例类
 */
MeshMgr._instance = null;
