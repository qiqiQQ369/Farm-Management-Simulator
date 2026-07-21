import { MeshSave } from "./mesh-save";
import { MeshToglTF } from "./mesh-to-gltf";
import { MeshToObj } from "./mesh-to-obj";

const { Mesh, gfx, MeshRenderer, Vec3 } = require('cc');
/**
 * 杨宗宝 2024/4/7
 * 负责拆分所有的子网格
 */
export class MeshSubSplit {
    static async split(node: any, data: any, isWorld: boolean, isObj: boolean): Promise<void> {
        let meshRenderer: any = node.getComponent(MeshRenderer);
        if (!meshRenderer) {
            console.warn("杨宗宝：子网格拆分异常,不存在MeshRenderer...");
            return;
        }
        let objDatas: string[] = [];
        let mesh: any = meshRenderer.mesh;
        let struct: any = mesh.struct;
        let primitives: any[] = struct.primitives;
        for (let i = 0; i < primitives.length; i++) {
            if (!data[i].select) {
                continue;
            }
            let positions = mesh.readAttribute(i, gfx.AttributeName.ATTR_POSITION);
            let normals = mesh.readAttribute(i, gfx.AttributeName.ATTR_NORMAL);
            let indices = mesh.readIndices(i);
            let uvs = mesh.readAttribute(i, gfx.AttributeName.ATTR_TEX_COORD);

            let ps: number[] = positions ? Array.from(positions) : null!;
            let ns: number[] = normals ? Array.from(normals) : null!;
            let us: number[] = uvs ? Array.from(uvs) : null!;
            let is: number[] = indices ? Array.from(indices) : null!;

            let _ps: number[] = [];
            let _ns: number[] = [];
            let _us: number[] = [];
            let _ls: number[] = [];
            for (let j = 0; j < is.length; j++) {
                let p = is[j];
                //顶点
                let vec: any = new Vec3(ps[p * 3], ps[p * 3 + 1], ps[p * 3 + 2]);
                if (isWorld) Vec3.transformMat4(vec, vec, meshRenderer.node.worldMatrix);
                _ps.push(vec.x);
                _ps.push(vec.y);
                _ps.push(vec.z);
                //法线
                _ns.push(ns[p * 3 + 0]);
                _ns.push(ns[p * 3 + 1]);
                _ns.push(ns[p * 3 + 2]);
                //uv
                let uvX: number = us[p * 2];
                let uvY: number = us[p * 2 + 1];
                _us.push(uvX);
                _us.push(uvY);
            }
            // 通过顶点计算出索引
            for (let i = 0; i < _ps.length; i += 3) {
                _ls.push(i / 3);
            }
            if (isObj) {
                let obj: string = await MeshToObj.obj(node.name, _ps, _ns, _us, _ls);
                objDatas.push(obj);
            } else {
                let glTF: string = await MeshToglTF.glTF(node.name, _ps, _ns, _us, _ls);
                objDatas.push(glTF);
            }
        }
        console.log("杨宗宝：子网格拆分数据解析成功...");
        if (isObj) {
            MeshSave.objs(objDatas);
        } else {
            MeshSave.glTFs(objDatas);
        }
    }
}