"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeshSubSplit = void 0;
const mesh_save_1 = require("./mesh-save");
const mesh_to_gltf_1 = require("./mesh-to-gltf");
const mesh_to_obj_1 = require("./mesh-to-obj");
const { Mesh, gfx, MeshRenderer, Vec3 } = require('cc');
/**
 * 杨宗宝 2024/4/7
 * 负责拆分所有的子网格
 */
class MeshSubSplit {
    static async split(node, data, isWorld, isObj) {
        let meshRenderer = node.getComponent(MeshRenderer);
        if (!meshRenderer) {
            console.warn("杨宗宝：子网格拆分异常,不存在MeshRenderer...");
            return;
        }
        let objDatas = [];
        let mesh = meshRenderer.mesh;
        let struct = mesh.struct;
        let primitives = struct.primitives;
        for (let i = 0; i < primitives.length; i++) {
            if (!data[i].select) {
                continue;
            }
            let positions = mesh.readAttribute(i, gfx.AttributeName.ATTR_POSITION);
            let normals = mesh.readAttribute(i, gfx.AttributeName.ATTR_NORMAL);
            let indices = mesh.readIndices(i);
            let uvs = mesh.readAttribute(i, gfx.AttributeName.ATTR_TEX_COORD);
            let ps = positions ? Array.from(positions) : null;
            let ns = normals ? Array.from(normals) : null;
            let us = uvs ? Array.from(uvs) : null;
            let is = indices ? Array.from(indices) : null;
            let _ps = [];
            let _ns = [];
            let _us = [];
            let _ls = [];
            for (let j = 0; j < is.length; j++) {
                let p = is[j];
                //顶点
                let vec = new Vec3(ps[p * 3], ps[p * 3 + 1], ps[p * 3 + 2]);
                if (isWorld)
                    Vec3.transformMat4(vec, vec, meshRenderer.node.worldMatrix);
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
            for (let i = 0; i < _ps.length; i += 3) {
                _ls.push(i / 3);
            }
            if (isObj) {
                let obj = await mesh_to_obj_1.MeshToObj.obj(node.name, _ps, _ns, _us, _ls);
                objDatas.push(obj);
            }
            else {
                let glTF = await mesh_to_gltf_1.MeshToglTF.glTF(node.name, _ps, _ns, _us, _ls);
                objDatas.push(glTF);
            }
        }
        console.log("杨宗宝：子网格拆分数据解析成功...");
        if (isObj) {
            mesh_save_1.MeshSave.objs(objDatas);
        }
        else {
            mesh_save_1.MeshSave.glTFs(objDatas);
        }
    }
}
exports.MeshSubSplit = MeshSubSplit;
