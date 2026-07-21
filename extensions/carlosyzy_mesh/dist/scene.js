"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = exports.unload = exports.load = void 0;
const mesh_mgr_1 = require("./mesh-mgr");
function load() { }
exports.load = load;
;
function unload() { }
exports.unload = unload;
;
exports.methods = {
    async mergeNodesMesh(data) {
        await mesh_mgr_1.MeshMgr.instance.mergeNodesMesh(data);
    },
    async analysisSplitSubMesh(uuid) {
        return mesh_mgr_1.MeshMgr.instance.analysisSplitSubMesh(uuid);
    },
    async splitSubMeshs(uuid, data) {
        await mesh_mgr_1.MeshMgr.instance.splitSubMeshs(uuid, data);
    },
    async convertTerrainToMesh(data) {
        await mesh_mgr_1.MeshMgr.instance.convertTerrainToMesh(data);
    },
    async getUVDatas(uuid) {
        return mesh_mgr_1.MeshMgr.instance.getUVDatas(uuid);
    }
};
