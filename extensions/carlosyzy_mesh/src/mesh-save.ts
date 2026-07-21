import {  outputFileSync, readJsonSync, existsSync } from 'fs-extra';
/**
 * 杨宗宝 2014/4/9
 * mesh 导出保存
 */
export class MeshSave {
    public static async obj(data: string) {
        const result = await Editor.Dialog.save({
            path: Editor.Project.path,
            title: 'Save Obj',
            filters: [
                { name: 'Obj', extensions: ['obj'] },
            ]
        })
        if (!result.filePath) {
            console.warn("杨宗宝：保存路径选择异常...");
            return;
        }
        outputFileSync(result.filePath, data);
        console.log(`杨宗宝：网格保存成功,路径：${result.filePath}`);
    }
    public static async objs(datas: string[]) {
        const result = await Editor.Dialog.save({
            path: Editor.Project.path,
            title: 'Save Obj',
            filters: [
                { name: 'Obj', extensions: ['obj'] },
            ]
        })
        if (!result.filePath) {
            console.warn("杨宗宝：保存路径选择异常...");
            return;
        }
        let index: number = result.filePath.lastIndexOf(".obj");
        for (let i = 0; i < datas.length; i++) {
            let path: string = result.filePath.substring(0, index) + "_" + i + ".obj";
            outputFileSync(path, datas[i]);
            console.log(`杨宗宝：网格${i + 1}保存成功,路径：${path}`);
        }
    }
    public static async glTF(data: string) {
        const result = await Editor.Dialog.save({
            path: Editor.Project.path,
            title: 'Save glTF',
            filters: [
                { name: 'gltf', extensions: ['gltf'] },
            ]
        })
        if (!result.filePath) {
            console.warn("杨宗宝：保存路径选择异常...");
            return;
        }
        outputFileSync(result.filePath, data);
        console.log(`杨宗宝：网格保存成功,路径：${result.filePath}`);
    }
    public static async glTFs(datas: string[]) {
        const result = await Editor.Dialog.save({
            path: Editor.Project.path,
            title: 'Save glTF',
            filters: [
                { name: 'gltf', extensions: ['gltf'] },
            ]
        })
        if (!result.filePath) {
            console.warn("杨宗宝：保存路径选择异常...");
            return;
        }
        let index: number = result.filePath.lastIndexOf(".gltf");
        for (let i = 0; i < datas.length; i++) {
            let path: string = result.filePath.substring(0, index) + "_" + i + ".gltf";
            outputFileSync(path, datas[i]);
            console.log(`杨宗宝：网格${i + 1}保存成功,路径：${path}`);
        }
    }
}