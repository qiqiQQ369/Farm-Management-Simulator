"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeshMerge = void 0;
const mesh_save_1 = require("./mesh-save");
const mesh_to_gltf_1 = require("./mesh-to-gltf");
const mesh_to_obj_1 = require("./mesh-to-obj");
const { Mesh, gfx, MeshRenderer, Vec3 } = require('cc');
/**
 * 杨宗宝 2024/4/7
 * 合并选中节点的所有网格
 */
class MeshMerge {
    /**
     * 合并所有子节点网格
     * @param node 父节点
     * @param isWorld 基于世界坐标还是本地坐标
     * @param isForce 是否强制合并（强制合并将不检测材质的相同性）
     */
    static async merge(name, renders, isWorld, isObj, isForce) {
        console.log(`杨宗宝：合并网格参数 isWorld:${isWorld} isObj:${isObj} isForce:${isForce} `);
        let meshRenderers = renders;
        //检测材质的一致性
        if (!isForce) {
            for (let i = 1; i < meshRenderers.length; i++) {
                if (!(meshRenderers[0].mesh.validateMergingMesh(meshRenderers[i].mesh))) {
                    console.warn("杨宗宝：合并网格数据不一致，不能正常合并....");
                    return;
                }
                if (!(this.checkMaterialisSame(meshRenderers[0], meshRenderers[i]))) {
                    console.warn("杨宗宝：合并网格材质不一致，不能正常合并....");
                    return;
                }
            }
        }
        let _positions = [];
        let _normals = [];
        let _uvs = [];
        let _indices = [];
        let _offset = 0;
        for (let i = 0; i < meshRenderers.length; i++) {
            let mesh = meshRenderers[i].mesh;
            let struct = mesh.struct;
            let primitives = struct.primitives;
            for (let j = 0; j < primitives.length; j++) {
                let positions = mesh.readAttribute(j, gfx.AttributeName.ATTR_POSITION);
                let normals = mesh.readAttribute(j, gfx.AttributeName.ATTR_NORMAL);
                let uvs = mesh.readAttribute(j, gfx.AttributeName.ATTR_TEX_COORD);
                let indices = mesh.readIndices(j);
                let ps = positions ? Array.from(positions) : null;
                let ns = normals ? Array.from(normals) : null;
                let us = uvs ? Array.from(uvs) : null;
                let is = indices ? Array.from(indices) : null;
                let _ps = [];
                let _ns = [];
                let _us = [];
                let _ls = [];
                for (let k = 0; k < is.length; k++) {
                    let p = is[k];
                    //顶点
                    let vec = new Vec3(ps[p * 3], ps[p * 3 + 1], ps[p * 3 + 2]);
                    if (isWorld) {
                        Vec3.transformMat4(vec, vec, meshRenderers[i].node.worldMatrix);
                    }
                    _ps.push(vec.x);
                    _ps.push(vec.y);
                    _ps.push(vec.z);
                    //法线
                    _ns.push(ns[p * 3 + 0]);
                    _ns.push(ns[p * 3 + 1]);
                    _ns.push(ns[p * 3 + 2]);
                    //uv
                    let uvX = us[p * 2];
                    let uvY = us[p * 2 + 1];
                    _us.push(uvX);
                    _us.push(uvY);
                }
                // 通过顶点计算出索引
                for (let n = 0; n < _ps.length; n += 3) {
                    _ls.push(_offset + n / 3);
                }
                _positions.push(..._ps);
                _normals.push(..._ns);
                _uvs.push(..._us);
                _indices.push(..._ls);
                _offset += _ps.length / 3;
            }
        }
        if (isObj) {
            let data = await mesh_to_obj_1.MeshToObj.obj(name, _positions, _normals, _uvs, _indices);
            console.log("杨宗宝：网格合并数据解析成功...");
            mesh_save_1.MeshSave.obj(data);
        }
        else {
            let data = await mesh_to_gltf_1.MeshToglTF.glTF(name, _positions, _normals, _uvs, _indices);
            console.log("杨宗宝：网格合并数据解析成功...");
            mesh_save_1.MeshSave.glTF(data);
        }
        return;
    }
    static checkMaterialisSame(comp1, comp2) {
        let matNum = comp1.sharedMaterials.length;
        if (matNum !== comp2.sharedMaterials.length) {
            return false;
        }
        for (let i = 0; i < matNum; i++) {
            if (comp1.getRenderMaterial(i) !== comp2.getRenderMaterial(i)) {
                return false;
            }
        }
        return true;
    }
}
exports.MeshMerge = MeshMerge;
