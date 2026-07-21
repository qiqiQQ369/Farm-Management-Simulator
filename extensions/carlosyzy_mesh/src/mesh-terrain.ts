import { MeshSave } from "./mesh-save";
import { MeshToglTF } from "./mesh-to-gltf";
import { MeshToObj } from "./mesh-to-obj";

const { Terrain, Vec3, Node } = require('cc');
/**
 * 杨宗宝 2024/4/9
 * 地形数据网格化
 */
export class MeshTerrain {
    public static async terrain(name: string, terrains: any[], isWorld: boolean, isMerge: boolean, isObj: boolean): Promise<void> {
        if (isMerge) {
            this.convertAndMeger(name, terrains, isWorld, isObj);
        } else {
            this.convert(name, terrains, isWorld, isObj);
        }

    }
    private static async convert(name: string, terrains: any[], isWorld: boolean, isObj: boolean): Promise<void> {
        let data: any[] = [];
        for (let i = 0; i < terrains.length; i++) {
            let _positions: number[] = [];
            let _normals: number[] = [];
            let _uvs: number[] = [];
            let _indices: number[] = [];

            let terrain: any = terrains[i];
            let vectors: any[] = [];
            let blocks: any[] = terrain.getBlocks();
            for (let o = 0; o < blocks.length; o++) {
                let _vectors: any[] = this.getTerrainMeshData(terrain, blocks[o], isWorld);
                vectors = vectors.concat(_vectors);
            }
            let offset = 0;
            for (let j = 0; j < vectors.length; j += 3) {
                let one: any = vectors[j];
                let tow: any = vectors[j + 1];
                let three: any = vectors[j + 2];
                let arrPos = [one, tow, three];
                for (let n = 0; n < arrPos.length; n++) {
                    _positions.push(arrPos[n].x);
                    _positions.push(arrPos[n].y);
                    _positions.push(arrPos[n].z);
                    _normals.push(0);
                    _normals.push(1);
                    _normals.push(0);
                    _uvs.push(0);
                    _uvs.push(0);
                }
                let indices = [offset, offset + 1, offset + 2];
                _indices.push(...indices);
                offset = _positions.length / 3;
            }
            if (isObj) {
                let obj: string = await MeshToObj.obj(name, _positions, _normals, _uvs, _indices);
                data.push(obj);
            } else {
                let glTF: string = await MeshToglTF.glTF(name, _positions, [], [], _indices);
                data.push(glTF);
            }
        }
        console.log("杨宗宝：terrain数据解析成功...");
        if (isObj) {
            MeshSave.objs(data);
        } else {
            MeshSave.glTFs(data);
        }
    }
    private static async convertAndMeger(name: string, terrains: any[], isWorld: boolean, isObj: boolean): Promise<void> {
        let _ps: number[] = [];
        let _ns: number[] = [];
        let _us: number[] = [];
        let _ls: number[] = [];
        let _offset: number = 0;

        for (let i = 0; i < terrains.length; i++) {
            let _positions: number[] = [];
            let _normals: number[] = [];
            let _uvs: number[] = [];
            let _indices: number[] = [];

            let terrain: any = terrains[i];
            let vectors: any[] = [];
            let blocks: any[] = terrain.getBlocks();
            for (let o = 0; o < blocks.length; o++) {
                let _vectors: any[] = this.getTerrainMeshData(terrain, blocks[o], isWorld);
                vectors = vectors.concat(_vectors);
            }
            let offset = 0;
            for (let j = 0; j < vectors.length; j += 3) {
                let one: any = vectors[j];
                let tow: any = vectors[j + 1];
                let three: any = vectors[j + 2];
                let arrPos = [one, tow, three];
                for (let n = 0; n < arrPos.length; n++) {
                    _positions.push(arrPos[n].x);
                    _positions.push(arrPos[n].y);
                    _positions.push(arrPos[n].z);
                    _normals.push(0);
                    _normals.push(1);
                    _normals.push(0);
                    _uvs.push(0);
                    _uvs.push(0);
                }
                let indices = [_offset + offset, _offset + offset + 1, _offset + offset + 2];
                _indices.push(...indices);
                offset = _positions.length / 3;
            }
            _ps.push(..._positions);
            _ns.push(..._normals);
            _us.push(..._uvs);
            _ls.push(..._indices);
            _offset += _positions.length / 3;
        }
        if (isObj) {
            let data: string = await MeshToObj.obj(name, _ps, _ns, _us, _ls);
            console.log("杨宗宝：网格合并数据解析成功...");
            MeshSave.obj(data);
        } else {
            let data: string = await MeshToglTF.glTF(name, _ps, [], [], _ls);
            console.log("杨宗宝：网格合并数据解析成功...");
            MeshSave.glTF(data);
        }
        return;
    }

    private static getTerrainMeshData(terrain: any, block: any, isWorld: boolean): any[] {
        let vectors: any[] = [];
        let index: number[] = block.getIndex();
        let TERRAIN_BLOCK_VERTEX_COMPLEXITY: number = 33;  //地形顶点复杂成都
        let TERRAIN_BLOCK_TILE_COMPLEXITY: number = 32;  //地形块瓦复杂性
        //网格化地形
        for (let j = 1; j < TERRAIN_BLOCK_VERTEX_COMPLEXITY; ++j) {
            for (let i = 1; i < TERRAIN_BLOCK_VERTEX_COMPLEXITY; ++i) {
                //左上角
                let x = index[0] * TERRAIN_BLOCK_TILE_COMPLEXITY + (i - 1);
                let y = index[1] * TERRAIN_BLOCK_TILE_COMPLEXITY + (j - 1);
                let one = new Vec3(1, 1, 1);
                if (isWorld) {
                    Vec3.transformMat4(one, terrain.getPosition(x, y), terrain.node.getWorldMatrix());
                } else {
                    one = terrain.getPosition(x, y);
                }

                //左下角
                x = index[0] * TERRAIN_BLOCK_TILE_COMPLEXITY + (i - 1);
                y = index[1] * TERRAIN_BLOCK_TILE_COMPLEXITY + (j);
                let two = new Vec3(1, 1, 1);
                if (isWorld) {
                    Vec3.transformMat4(two, terrain.getPosition(x, y), terrain.node.getWorldMatrix());
                } else {
                    two = terrain.getPosition(x, y);
                }
                //右上角
                x = index[0] * TERRAIN_BLOCK_TILE_COMPLEXITY + (i);
                y = index[1] * TERRAIN_BLOCK_TILE_COMPLEXITY + (j - 1);
                let three = new Vec3(1, 1, 1);
                if (isWorld) {
                    Vec3.transformMat4(three, terrain.getPosition(x, y), terrain.node.getWorldMatrix());
                } else {
                    three = terrain.getPosition(x, y);
                }
                //右下角
                x = index[0] * TERRAIN_BLOCK_TILE_COMPLEXITY + (i);
                y = index[1] * TERRAIN_BLOCK_TILE_COMPLEXITY + (j);
                let four = new Vec3(1, 1, 1);
                if (isWorld) {
                    Vec3.transformMat4(four, terrain.getPosition(x, y), terrain.node.getWorldMatrix());
                } else {
                    four = terrain.getPosition(x, y);
                }
                //第一个三角形
                vectors.push(one);
                vectors.push(two);
                vectors.push(four);
                //第二个三角形
                vectors.push(one);
                vectors.push(four);
                vectors.push(three);

            }
        }
        return vectors;
    }
}