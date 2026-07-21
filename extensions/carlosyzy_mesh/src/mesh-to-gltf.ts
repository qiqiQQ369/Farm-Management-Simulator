
const fs = require('fs');
import { NodeIO, Accessor, Document, Primitive, Mesh, Buffer, Format, FileUtils, Scene, Node } from '@gltf-transform/core';
import { outputJsonSync, outputFileSync, readJsonSync, existsSync, } from 'fs-extra';
/**
 * 杨宗宝 2024/4/7
 * 网格数据转obj
 */
export class MeshToglTF {
    static async glTF(name: string, positions: number[], normals: number[], uvs: number[], indices: number[]): Promise<string> {
        //顶点
        let _positions = new Float32Array(positions);
        // 法线数据
        let _normals = new Float32Array(normals);
        // UV 坐标
        let _uvs = new Float32Array(uvs);
        // 索引数据
        let _indices = new Uint32Array(indices);

        //创建gltf数据
        let doc: Document = new Document();
        let scene: Scene = doc.createScene("carlosyzy");
        let node: Node = doc.createNode("carlosyzy");
        scene.addChild(node);

        let primitive: Primitive = doc.createPrimitive();

        let posoitonBuffer: Buffer = doc.createBuffer()
            .setURI("posoitonBuffer.bin");
        let positionAccessor: Accessor = doc.createAccessor("POSITION")
            .setArray(_positions)
            .setType(Accessor.Type.VEC3)
            .setBuffer(posoitonBuffer);
        primitive.setAttribute('POSITION', positionAccessor);
        //法线
        if (_normals.length > 0) {
            let normalBuffer: Buffer = doc.createBuffer()
                .setURI("normalBuffer.bin");
            let normalAccessor: Accessor = doc.createAccessor("NORMAL")
                .setArray(_normals)
                .setType(Accessor.Type.VEC3)
                .setBuffer(normalBuffer);
            primitive.setAttribute('NORMAL', normalAccessor);
        }
        //uv
        if (_uvs.length > 0) {
            let uvBuffer: Buffer = doc.createBuffer()
                .setURI("uvBuffer.bin");
            let uvAccessor: Accessor = doc.createAccessor("TEXCOORD_0")
                .setArray(_uvs)
                .setType(Accessor.Type.VEC2)
                .setBuffer(uvBuffer);
            primitive.setAttribute('TEXCOORD_0', uvAccessor);
        }
        //索引
        let indicesBuffer: Buffer = doc.createBuffer()
            .setURI("indicesBuffer.bin");
        let indicesAccessor: Accessor = doc.createAccessor("INDICES")
            .setArray(_indices)
            .setType(Accessor.Type.SCALAR)
            .setBuffer(indicesBuffer);
        primitive.setIndices(indicesAccessor);
        let mesh: Mesh = doc.createMesh(name);
        mesh.addPrimitive(primitive);
        node.setMesh(mesh);

        let io: NodeIO = new NodeIO();
        let { json, resources } = await io.writeJSON(doc, {
            format: Format.GLTF,
            // basename: FileUtils.basename(result.filePath),
            basename: FileUtils.basename(""),
        });
        // console.log(json)
        // console.log(resources)
        let data: string = JSON.stringify(json);
        let positionBase64: string = "data:application/octet-stream;base64," + this.base64(_positions);
        let normalBase64: string = "data:application/octet-stream;base64," + this.base64(_normals);
        let uvBase64: string = "data:application/octet-stream;base64," + this.base64(_uvs);
        let indicesBase64: string = "data:application/octet-stream;base64," + this.base64(_indices);
        data = data.replace("posoitonBuffer.bin", positionBase64);
        data = data.replace("normalBuffer.bin", normalBase64);
        data = data.replace("uvBuffer.bin", uvBase64);
        data = data.replace("indicesBuffer.bin", indicesBase64);
        return data;
    }
    private static base64(floatArray: any): string {
        // 将 Float32Array 转换为 ArrayBuffer
        const arrayBuffer = floatArray.buffer;
        // 创建一个 Uint8Array 来表示 ArrayBuffer 中的数据
        const uint8Array = new Uint8Array(arrayBuffer);
        // 将 Uint8Array 转换为 Base64 字符串
        //@ts-ignore
        const base64String = btoa(String.fromCharCode.apply(null, uint8Array));
        return base64String;

    }
}