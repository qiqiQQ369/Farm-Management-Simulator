"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeshSave = void 0;
const fs_extra_1 = require("fs-extra");
/**
 * 杨宗宝 2014/4/9
 * mesh 导出保存
 */
class MeshSave {
    static async obj(data) {
        const result = await Editor.Dialog.save({
            path: Editor.Project.path,
            title: 'Save Obj',
            filters: [
                { name: 'Obj', extensions: ['obj'] },
            ]
        });
        if (!result.filePath) {
            console.warn("杨宗宝：保存路径选择异常...");
            return;
        }
        (0, fs_extra_1.outputFileSync)(result.filePath, data);
        console.log(`杨宗宝：网格保存成功,路径：${result.filePath}`);
    }
    static async objs(datas) {
        const result = await Editor.Dialog.save({
            path: Editor.Project.path,
            title: 'Save Obj',
            filters: [
                { name: 'Obj', extensions: ['obj'] },
            ]
        });
        if (!result.filePath) {
            console.warn("杨宗宝：保存路径选择异常...");
            return;
        }
        let index = result.filePath.lastIndexOf(".obj");
        for (let i = 0; i < datas.length; i++) {
            let path = result.filePath.substring(0, index) + "_" + i + ".obj";
            (0, fs_extra_1.outputFileSync)(path, datas[i]);
            console.log(`杨宗宝：网格${i + 1}保存成功,路径：${path}`);
        }
    }
    static async glTF(data) {
        const result = await Editor.Dialog.save({
            path: Editor.Project.path,
            title: 'Save glTF',
            filters: [
                { name: 'gltf', extensions: ['gltf'] },
            ]
        });
        if (!result.filePath) {
            console.warn("杨宗宝：保存路径选择异常...");
            return;
        }
        (0, fs_extra_1.outputFileSync)(result.filePath, data);
        console.log(`杨宗宝：网格保存成功,路径：${result.filePath}`);
    }
    static async glTFs(datas) {
        const result = await Editor.Dialog.save({
            path: Editor.Project.path,
            title: 'Save glTF',
            filters: [
                { name: 'gltf', extensions: ['gltf'] },
            ]
        });
        if (!result.filePath) {
            console.warn("杨宗宝：保存路径选择异常...");
            return;
        }
        let index = result.filePath.lastIndexOf(".gltf");
        for (let i = 0; i < datas.length; i++) {
            let path = result.filePath.substring(0, index) + "_" + i + ".gltf";
            (0, fs_extra_1.outputFileSync)(path, datas[i]);
            console.log(`杨宗宝：网格${i + 1}保存成功,路径：${path}`);
        }
    }
}
exports.MeshSave = MeshSave;
