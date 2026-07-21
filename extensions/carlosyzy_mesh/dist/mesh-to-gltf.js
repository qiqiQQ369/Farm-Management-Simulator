"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeshToglTF = void 0;
const fs = require('fs');
const core_1 = require("@gltf-transform/core");
/**
 * 杨宗宝 2024/4/7
 * 网格数据转obj
 */
class MeshToglTF {
    static async glTF(name, positions, normals, uvs, indices) {
        //顶点
        let _positions = new Float32Array(positions);
        // 法线数据
        let _normals = new Float32Array(normals);
        // UV 坐标
        let _uvs = new Float32Array(uvs);
        // 索引数据
        let _indices = new Uint32Array(indices);
        //创建gltf数据
        let doc = new core_1.Document();
        let scene = doc.createScene("carlosyzy");
        let node = doc.createNode("carlosyzy");
        scene.addChild(node);
        let primitive = doc.createPrimitive();
        let posoitonBuffer = doc.createBuffer()
            .setURI("posoitonBuffer.bin");
        let positionAccessor = doc.createAccessor("POSITION")
            .setArray(_positions)
            .setType(core_1.Accessor.Type.VEC3)
            .setBuffer(posoitonBuffer);
        primitive.setAttribute('POSITION', positionAccessor);
        //法线
        if (_normals.length > 0) {
            let normalBuffer = doc.createBuffer()
                .setURI("normalBuffer.bin");
            let normalAccessor = doc.createAccessor("NORMAL")
                .setArray(_normals)
                .setType(core_1.Accessor.Type.VEC3)
                .setBuffer(normalBuffer);
            primitive.setAttribute('NORMAL', normalAccessor);
        }
        //uv
        if (_uvs.length > 0) {
            let uvBuffer = doc.createBuffer()
                .setURI("uvBuffer.bin");
            let uvAccessor = doc.createAccessor("TEXCOORD_0")
                .setArray(_uvs)
                .setType(core_1.Accessor.Type.VEC2)
                .setBuffer(uvBuffer);
            primitive.setAttribute('TEXCOORD_0', uvAccessor);
        }
        //索引
        let indicesBuffer = doc.createBuffer()
            .setURI("indicesBuffer.bin");
        let indicesAccessor = doc.createAccessor("INDICES")
            .setArray(_indices)
            .setType(core_1.Accessor.Type.SCALAR)
            .setBuffer(indicesBuffer);
        primitive.setIndices(indicesAccessor);
        let mesh = doc.createMesh(name);
        mesh.addPrimitive(primitive);
        node.setMesh(mesh);
        let io = new core_1.NodeIO();
        let { json, resources } = await io.writeJSON(doc, {
            format: core_1.Format.GLTF,
            // basename: FileUtils.basename(result.filePath),
            basename: core_1.FileUtils.basename(""),
        });
        // console.log(json)
        // console.log(resources)
        let data = JSON.stringify(json);
        let positionBase64 = "data:application/octet-stream;base64," + this.base64(_positions);
        let normalBase64 = "data:application/octet-stream;base64," + this.base64(_normals);
        let uvBase64 = "data:application/octet-stream;base64," + this.base64(_uvs);
        let indicesBase64 = "data:application/octet-stream;base64," + this.base64(_indices);
        data = data.replace("posoitonBuffer.bin", positionBase64);
        data = data.replace("normalBuffer.bin", normalBase64);
        data = data.replace("uvBuffer.bin", uvBase64);
        data = data.replace("indicesBuffer.bin", indicesBase64);
        return data;
    }
    static base64(floatArray) {
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
exports.MeshToglTF = MeshToglTF;
