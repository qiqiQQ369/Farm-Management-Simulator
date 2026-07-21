"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeshUV = void 0;
const { MeshRenderer } = require('cc');
/**
 * mesh uv查看器
 */
class MeshUV {
    /**
     * 获取模型的uv数据
     */
    static getMeshUv(uuid) {
        let node = cce.Node.query(uuid);
        if (node) {
            let compMeshRender = node.getComponent(MeshRenderer);
            if (compMeshRender) {
                return this.getUvsData(compMeshRender);
            }
            else {
                console.warn("杨宗宝：当前选中节点未挂载MeshRender组件....");
            }
            return "{}";
        }
        else {
            console.warn("杨宗宝：请先在场景或者层级管理器中选择对于的节点....");
            return "{}";
        }
    }
    static getUvsData(meshRenderer) {
        let mesh = meshRenderer.mesh;
        let struct = mesh.struct;
        let primitives = struct.primitives;
        let meshData = {};
        meshData["len"] = primitives.length;
        meshData["sub"] = [];
        for (let i = 0; i < primitives.length; i++) {
            let uvData = {};
            let indices = mesh.readIndices(i);
            let is = indices ? Array.from(indices) : null;
            if (!is) {
                console.warn("杨宗宝：未获取到网格的索引，请确定网格是否正常");
                return "{}";
            }
            let _uvs = [];
            for (let j = 0; j < this._ATTR_TEX_COORD.length; j++) {
                let uv = mesh.readAttribute(i, this._ATTR_TEX_COORD[j]);
                if (uv) {
                    let _uv = Array.from(uv);
                    _uvs.push(_uv);
                }
                else {
                    break;
                }
            }
            uvData["len"] = _uvs.length;
            let uvs = [];
            for (let u = 0; u < _uvs.length; u++) {
                let _uv = _uvs[u];
                let uv = [];
                for (let j = 0; j < is.length; j++) {
                    let p = is[j];
                    let uvX = _uv[p * 2];
                    let uvY = _uv[p * 2 + 1];
                    //console.log("::"+uvY);
                    //Cocos的uv在每个坐标系中  y轴都是相反的 进行转换
                    if (uvY % 1 != 0) {
                        if (uvY >= 0) {
                            let f = Math.floor(uvY);
                            uvY = f + (1.0 - (uvY - f));
                        }
                        else {
                            let f = Math.ceil(uvY);
                            uvY = f - (1.0 - (f - uvY));
                        }
                    }
                    uv.push(uvX);
                    uv.push(uvY);
                }
                uvs.push(uv);
            }
            uvData["uv"] = uvs;
            meshData["sub"].push(uvData);
        }
        return JSON.stringify(meshData);
    }
}
exports.MeshUV = MeshUV;
MeshUV._ATTR_TEX_COORD = ["a_texCoord", "a_texCoord1", "a_texCoord2", "a_texCoord3", "a_texCoord4", "a_texCoord5", "a_texCoord6", "a_texCoord7", "a_texCoord8"];
