import { MeshSave } from "./mesh-save";
import { MeshToglTF } from "./mesh-to-gltf";
import { MeshToObj } from "./mesh-to-obj";

const { Mesh, gfx, MeshRenderer, Vec3 } = require('cc');
/**
 * 杨宗宝 2024/4/7
 * 合并选中节点的所有网格
 */
export class MeshMerge {
    /**
     * 合并所有子节点网格
     * @param node 父节点
     * @param isWorld 基于世界坐标还是本地坐标
     * @param isForce 是否强制合并（强制合并将不检测材质的相同性）
     */
    static async merge(name: string, renders: any[], isWorld: boolean, isObj: boolean, isForce: boolean): Promise<void> {
        console.log(`杨宗宝：合并网格参数 isWorld:${isWorld} isObj:${isObj} isForce:${isForce} `);
        let meshRenderers: any[] = renders;
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
        let _positions: number[] = [];
        let _normals: number[] = [];
        let _uvs: number[] = [];
        let _indices: number[] = [];
        let _offset: number = 0;
        for (let i = 0; i < meshRenderers.length; i++) {
            let mesh: any = meshRenderers[i].mesh;
            let struct: any = mesh.struct;
            let primitives: any[] = struct.primitives;
            for (let j = 0; j < primitives.length; j++) {
                let positions = mesh.readAttribute(j, gfx.AttributeName.ATTR_POSITION);
                let normals = mesh.readAttribute(j, gfx.AttributeName.ATTR_NORMAL);
                let uvs = mesh.readAttribute(j, gfx.AttributeName.ATTR_TEX_COORD);
                let indices = mesh.readIndices(j);
                let ps: number[] = positions ? Array.from(positions) : null!;
                let ns: number[] = normals ? Array.from(normals) : null!;
                let us: number[] = uvs ? Array.from(uvs) : null!;
                let is: number[] = indices ? Array.from(indices) : null!;
                let _ps: number[] = [];
                let _ns: number[] = [];
                let _us: number[] = [];
                let _ls: number[] = [];
                for (let k = 0; k < is.length; k++) {
                    let p = is[k];
                    //顶点
                    let vec: any = new Vec3(ps[p * 3], ps[p * 3 + 1], ps[p * 3 + 2]);
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
                    let uvX: number = us[p * 2];
                    let uvY: number = us[p * 2 + 1];
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
            let data: string = await MeshToObj.obj(name, _positions, _normals, _uvs, _indices);
            console.log("杨宗宝：网格合并数据解析成功...");
            MeshSave.obj(data);
        } else {
            let data: string = await MeshToglTF.glTF(name, _positions, _normals, _uvs, _indices);
            console.log("杨宗宝：网格合并数据解析成功...");
            MeshSave.glTF(data);
        }
        return;
    }
    private static checkMaterialisSame(comp1: any, comp2: any): boolean {
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