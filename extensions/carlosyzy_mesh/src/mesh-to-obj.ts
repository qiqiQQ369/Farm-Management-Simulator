const { Mesh, gfx } = require('cc');
/**
 * 杨宗宝 2024/4/7
 * 网格数据转obj
 */
export class MeshToObj {
    static async obj(name: string, positions: number[], normals: number[], uvs: number[], indices: number[]): Promise<string> {
        let objData = "";
        let v = "";
        let vn = "";
        let vt = "";
        let f = "";
        //顶点
        // let positions = mesh.readAttribute(0, gfx.AttributeName.ATTR_POSITION);
        for (let i = 0; i < positions.length; i += 3) {
            v += "v " + positions[i] + " " + positions[i + 1] + " " + positions[i + 2] + "\n";
        }
        //法线
        // let normals = mesh.readAttribute(0, gfx.AttributeName.ATTR_NORMAL);
        for (let i = 0; i < normals.length; i += 3) {
            vn += "vn " + normals[i] + " " + normals[i + 1] + " " + normals[i + 2] + "\n";
        }
        //uv
        // let uvs = mesh.readAttribute(0, gfx.AttributeName.ATTR_TEX_COORD);
        for (let i = 0; i < uvs.length; i += 2) {
            vt += "vt " + uvs[i] + " " + (1.0 - uvs[i + 1]) + "\n";
        }
        // let indices = mesh.readIndices(0);
        //三个点一个面
        for (let i = 0; i < indices.length; i += 3) {
            f += "f " + (indices[i] + 1) + "/" + (indices[i] + 1) + "/" + (indices[i] + 1) + " " + (indices[i + 1] + 1) + "/" + (indices[i + 1] + 1) + "/" + (indices[i + 1] + 1) + " " + (indices[i + 2] + 1) + "/" + (indices[i + 2] + 1) + "/" + (indices[i + 2] + 1) + "\n";
        }
        objData += "# 杨宗宝\n";
        objData += "o " + name + "\n";
        objData += v;
        objData += vt;
        objData += vn;
        objData += "usemtl None\n";
        objData += "s off\n";
        objData += f;
        return objData;
    }
}