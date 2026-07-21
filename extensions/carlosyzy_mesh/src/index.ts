import { readFileSync } from 'fs-extra';
import { join } from 'path';
import Vue from 'vue/dist/vue';
// @ts-ignore
import packageJSON from '../package.json';
import { ExecuteSceneScriptMethodOptions } from '../@types/packages/scene/@types/public';
const component = Vue.extend({
    template: readFileSync(join(__dirname, '../static/app.html'), 'utf-8'),
    data() {
        return {
            menuItems: [
                { title: "多节点网格合并", color: "#535353", display: "" },
                { title: "单节点子网格拆分", color: "#252525", display: "none" },
                { title: "Terrain转网格", color: "#252525", display: "none" },
                { title: "UV 查看器", color: "#252525", display: "none" }
            ],
            menuIndex: 0,
            nodesMeshMergeDatas: [{ uuid: "", childs: true }], //节点网格合并

            subMeshSplitUUid: "",
            subMeshSplitDatas: [{ name: "子网格0", select: true }],

            terrianConvertMeshData: [{ uuid: "" }],

            meshIsForce: true,
            meshIsWorld: true,
            mergeTerrain: false,

            isUV: false,
            uvPanelSize: { width: 500, height: 360 },
            uvCanvas: null as any,
            uvContext: null as any,
            uvcanvasW: 0,
            uvcanvasH: 0,
            uvCenterX: 0,
            uvCenterY: 0,
            uvInterval: 3.5,
            uvPanelTouch: false,
            uvPanelTouchMove: { x: 0, y: 0 },
            uvPanelOffset: { x: 0, y: 0 },
            uvDatas: null as any,
            uvSubMeshIndex: 0,
            uvSubUVIndex: 0,
            uvSubMesh: [{ label: "子网格", value: 0 }],
            uvSubUV: [{ label: "uv", value: 0 }],

            saveData: {
                isObj: true,
                isGlTF: false,
                isShowSave: "",
            }
        };
    },
    mounted() {
        this.saveData.isShowSave = "";
    },
    methods: {
        onChangeNemu(index: any) {
            if (this.menuIndex == index) return;
            this.menuIndex = Number(index);
            if (this.menuIndex == 0) {
                this.nodesMeshMergeDatas = [{ uuid: "", childs: true }];
                this.meshIsForce = true;
                this.meshIsWorld = true;
                this.saveData.isShowSave = "";
                this.closeUVPanel();
            } else if (this.menuIndex == 1) {
                this.meshIsForce = false;
                this.meshIsWorld = false;
                this.subMeshSplitDatas = [];
                this.saveData.isShowSave = "";
                this.closeUVPanel();
            } else if (this.menuIndex == 2) {
                this.terrianConvertMeshData = [];
                this.meshIsWorld = true;
                this.mergeTerrain = true;
                this.terrianConvertMeshData = [{ uuid: "" }];
                this.saveData.isShowSave = "";
                this.closeUVPanel();
            } else if (this.menuIndex == 3) {
                this.saveData.isShowSave = "none";
            }



            for (let i = 0; i < this.menuItems.length; i++) {
                if (index == i) {
                    this.menuItems[i].color = "#535353";
                    this.menuItems[i].display = "";
                } else {
                    this.menuItems[i].color = "#252525";
                    this.menuItems[i].display = "none";
                }
            }

            if (this.menuIndex == 0) {

            } else if (this.menuIndex == 1) {

            } else if (this.menuIndex == 2) {

            } else if (this.menuIndex == 3) {
                this.openUVPanel();
            }
        },

        onOperateMeshForce(force: boolean) {
            this.meshIsForce = force;
        },
        onOperateMeshWorld(world: boolean) {
            this.meshIsWorld = world;
        },
        onOperateMegerTerrain(mergeTerrain: boolean) {
            this.mergeTerrain = mergeTerrain;
        },

        /***************************选中节点合并* start*********************************** */
        /**
         * 添加需要合并mesh的节点
         */
        addNodeMeshMerge() {
            this.nodesMeshMergeDatas.push({ uuid: "", childs: true });
        },

        bindNodeMeshMergeNode(index: any, uuid: any) {
            let i = Number(index);
            this.nodesMeshMergeDatas[i].uuid = uuid;
        },
        changeNodeMeshMergeNodeChilds(index: any, childs: boolean) {
            let i = Number(index);
            this.nodesMeshMergeDatas[i].childs = childs;
        },
        delNodeMeshMerge(index: any) {
            let i: number = Number(index);
            this.nodesMeshMergeDatas.splice(i, 1);
        },
        /***************************选中节点合并* end*********************************** */
        /***************************子网格拆分* start*********************************** */
        async bindSubMeshSplit(uuid: any) {
            this.subMeshSplitDatas = [];
            this.subMeshSplitUUid = uuid;
            if (this.subMeshSplitUUid.length <= 0) {
                return;
            }
            let options: ExecuteSceneScriptMethodOptions = {
                name: 'carlosyzy_mesh',
                method: 'analysisSplitSubMesh',
                args: [uuid]
            }
            let subMeshLen: string = await Editor.Message.request('scene', 'execute-scene-script', options);
            for (let i = 0; i < Number(subMeshLen); i++) {
                this.subMeshSplitDatas.push({
                    name: "子网格" + (i + 1),
                    select: true,
                });
            }
        },
        onSubMeshSplitSelect(index: any, select: boolean) {
            let i = Number(index);
            this.subMeshSplitDatas[i].select = select;
        },

        /***************************子网格拆分* end*********************************** */
        /***************************地形转换* start*********************************** */
        addTerrainNode(): void {
            this.terrianConvertMeshData.push({ uuid: "" });
        },
        bindNodeTerrainConvertMesh(index: any, uuid: any) {
            let i = Number(index);
            this.terrianConvertMeshData[i].uuid = uuid;
        },
        delNodeTerrainConvertMesh(index: any) {
            let i: number = Number(index);
            this.terrianConvertMeshData.splice(i, 1);
        },
        /***************************地形转换* end*********************************** */
        changeSaveObjFormat(isObj: boolean) {
            this.saveData.isObj = isObj;
            this.saveData.isGlTF = !isObj;
        },
        changeSaveGlTFFormat(isGlTF: boolean) {
            this.saveData.isGlTF = isGlTF;
            this.saveData.isObj = !isGlTF;
        },
        async onSaveMesh() {
            if (this.menuIndex == 0) {
                //多节点网格合并
                if (this.nodesMeshMergeDatas.length <= 0) {
                    return;
                }
                let data: any = {
                    data: this.nodesMeshMergeDatas,
                    isWorld: this.meshIsWorld,
                    isForce: this.meshIsForce,
                    isObj: this.saveData.isObj,
                }
                let options: ExecuteSceneScriptMethodOptions = {
                    name: 'carlosyzy_mesh',
                    method: 'mergeNodesMesh',
                    args: [JSON.stringify(data)]
                }
                await Editor.Message.request('scene', 'execute-scene-script', options);
            } else if (this.menuIndex == 1) {
                //单节点 子网格拆分
                if (this.subMeshSplitDatas.length <= 0) {
                    return;
                }
                let data: any = {
                    data: this.subMeshSplitDatas,
                    isWorld: this.meshIsWorld,
                    isObj: this.saveData.isObj,
                }
                let options: ExecuteSceneScriptMethodOptions = {
                    name: 'carlosyzy_mesh',
                    method: 'splitSubMeshs',
                    args: [this.subMeshSplitUUid, JSON.stringify(data)]
                }
                await Editor.Message.request('scene', 'execute-scene-script', options);
            } else if (this.menuIndex == 2) {
                //地形数据网格化
                if (this.terrianConvertMeshData.length <= 0) {
                    return;
                }

                let data: any = {
                    data: this.terrianConvertMeshData,
                    isWorld: this.meshIsWorld,
                    isObj: this.saveData.isObj,
                    merge: this.mergeTerrain,
                }
                let options: ExecuteSceneScriptMethodOptions = {
                    name: 'carlosyzy_mesh',
                    method: 'convertTerrainToMesh',
                    args: [JSON.stringify(data)]
                }
                await Editor.Message.request('scene', 'execute-scene-script', options);
            }
        },

        /***************************uv 查看器* start*********************************** */
        async bindUVLookNode(uuid: string) {
            this.uvSubMesh = [];
            this.uvSubUV = [];
            this.uvDatas = null;
            // let refs: any = this.$refs;
            // refs.uvSubMeshSelect.value = -1;
            // refs.uvSubMeshSelect.value = -1;
            this.updateUV();
            let options: ExecuteSceneScriptMethodOptions = {
                name: "carlosyzy_mesh",
                method: 'getUVDatas',
                args: [uuid]
            }
            let data: any = await Editor.Message.request('scene', 'execute-scene-script', options);
            // console.log(data)
            if (data.length > 4) {
                this.uvDatas = JSON.parse(data)!;
                this.setMeshAndUVList()
            }
        },
        setMeshAndUVList(): void {
            let subLen: any = this.uvDatas["len"];
            if (subLen > 0) {
                for (let i = 0; i < subLen; i++) {
                    this.uvSubMesh.push({ label: "子网格" + (i + 1), value: i });
                }
                let uvs: any = this.uvDatas["sub"][0];
                let uvLen = uvs["len"];
                if (uvLen > 0) {
                    for (let i = 0; i < uvLen; i++) {
                        this.uvSubUV.push({ label: "uv" + (i + 1), value: i });
                    }
                }
            }
            this.uvSubMeshIndex = 0;
            this.uvSubUVIndex = 0;
            this.updateUV();
        },
        onUVSubMeshSelect(index: any) {
            // console.log("选中网格更新：" + index);
            this.uvSubMeshIndex = Number(index);
            this.uvSubUVIndex = 0;
            this.updateUV();
        },
        onUvSubUvSelect(index: any) {
            // console.log("选中uv更新：" + index);
            this.uvSubUVIndex = Number(index);
            this.updateUV();
        },

        openUVPanel() {
            if (this.isUV) return;
            this.isUV = true;
            this.uvPanelTouch = false;
            this.uvPanelOffset.x = -140;
            this.uvPanelOffset.y = 150;
            let refs: any = this.$refs;
            this.uvCanvas = refs.canvas;
            this.uvContext = this.uvCanvas.getContext("2d");
            setTimeout(() => {
                this.onUVPanelChange();
            }, 50)
            this.onUVEventLeistner();

        },
        onUVEventLeistner() {
            window.addEventListener('resize', this.onUVPanelChange);
            this.uvCanvas.addEventListener('mousedown', this.canvasMouseTouchStart);
            this.uvCanvas.addEventListener('mousemove', this.canvasMouseTouchMove);
            this.uvCanvas.addEventListener('mouseup', this.canvasMouseTouchEnd);
            this.uvCanvas.addEventListener("mousewheel", this.canvasMouseWheel);
        },
        canvasMouseTouchStart(event: any): void {
            this.uvPanelTouch = true;
            this.uvPanelTouchMove.x = event.pageX;
            this.uvPanelTouchMove.y = event.pageY;
        },
        canvasMouseTouchMove(event: any): void {
            if (!this.uvPanelTouch) return;
            let x = event.pageX - this.uvPanelTouchMove.x;
            let y = event.pageY - this.uvPanelTouchMove.y;
            this.uvPanelTouchMove.x = event.pageX;
            this.uvPanelTouchMove.y = event.pageY;
            this.uvPanelOffset.x += x;
            this.uvPanelOffset.y += y;
            this.updateUV();
        },
        canvasMouseTouchEnd(event: any): void {
            this.uvPanelTouch = false;
        },
        canvasMouseWheel(event: any): void {
            //根据放大和缩小的比例，重新计算坐标中心点的位置
            let _centerX: number = this.uvCenterX - this.uvcanvasW / 2.0;
            let _centerY: number = this.uvCenterY - this.uvcanvasH / 2.0;
            let scale: number = 0.2;
            if (event.wheelDelta > 0) {
                // 放大
                if (this.uvInterval > 6) {
                    return;
                }
                this.uvInterval += scale;
                //重新计算x
                this.uvCenterX += _centerX * scale;
                //重新计算y
                this.uvCenterY += _centerY * scale;

            } else {
                // 缩小
                if (this.uvInterval < 3) {
                    return;
                }
                this.uvInterval -= scale;
                //重新计算x
                this.uvCenterX -= _centerX * scale;
                //重新计算y
                this.uvCenterY -= _centerY * scale;
            }
            this.updateUV();
        },
        onUVPanelChange(): void {
            let refs: any = this.$refs;
            this.uvPanelSize.width = refs.canvas_parent.offsetWidth;
            this.uvPanelSize.height = refs.canvas_parent.offsetHeight;
            this.uvcanvasW = 700;
            this.uvcanvasH = 700 * (this.uvPanelSize.height / this.uvPanelSize.width);
            this.uvCanvas.width = this.uvcanvasW;
            this.uvCanvas.height = this.uvcanvasH;
            this.updateUV();
        },
        updateUV() {
            this.renderUVGrid();
            this.renderUv();
        },
        renderUVGrid() {
            this.uvCenterX = this.uvcanvasW / 2 + this.uvPanelOffset.x;
            this.uvCenterY = this.uvcanvasH / 2 + this.uvPanelOffset.y;
            this.uvContext.clearRect(0, 0, this.uvcanvasW, this.uvcanvasH);
            //x坐标系
            this.renderLine([0, this.uvCenterY, this.uvcanvasW, this.uvCenterY], 0.5, "rgb(255, 0, 0,255)");
            //y轴坐标
            this.renderLine([this.uvCenterX, 0, this.uvCenterX, this.uvcanvasH], 0.5, "rgb(0, 0, 255,255)");

            //绘制平行于Y轴的网格
            for (let i = 1; i <= 60; i++) {
                let lineWidth: number = 0.4;
                let lineColor: string = "rgb(25, 25, 25)";
                let fontSize: number = 8;
                if (i % 10 === 0) {
                    lineColor = "rgb(5, 5, 5)";
                    lineWidth = 0.5;
                    fontSize = 13;
                }
                //正方向
                this.renderLine([this.uvCenterX + i * this.uvInterval * 10, 0, this.uvCenterX + i * this.uvInterval * 10, this.uvcanvasH], lineWidth, lineColor);
                this.renderText((i / 10) + "", this.uvCenterX + i * this.uvInterval * 10 - 5, this.uvCenterY + 3, fontSize, "rgb(15, 15, 15)");
                //负方向
                this.renderLine([-1 * i * this.uvInterval * 10 + this.uvCenterX, 0, -1 * i * this.uvInterval * 10 + this.uvCenterX, this.uvcanvasH], lineWidth, lineColor);
                this.renderText((-1 * i / 10) + "", -1 * i * this.uvInterval * 10 + this.uvCenterX - 5, this.uvCenterY + 3, fontSize, "rgb(15, 15, 15)");
            }
            for (let i = 1; i <= 60; i++) {
                let lineWidth: number = 0.4;
                let lineColor: string = "rgb(25, 25, 25)";
                let fontSize: number = 8;
                if (i % 10 === 0) {
                    lineColor = "rgb(5, 5, 5)";
                    lineWidth = 0.5;
                    fontSize = 13;
                }
                let dir: number = 1;
                // if (this.uvType === 0) {
                //     dir = -1;
                // }
                //正方向
                this.renderLine([0, this.uvCenterY - i * this.uvInterval * 10, this.uvcanvasW, this.uvCenterY - i * this.uvInterval * 10], lineWidth, lineColor);
                this.renderText((dir * i / 10) + "", this.uvCenterX + 3, this.uvCenterY - i * this.uvInterval * 10 - 5, fontSize, "rgb(15, 15, 15)");
                //负方向
                this.renderLine([0, this.uvCenterY - (-1 * i * this.uvInterval * 10), this.uvcanvasW, this.uvCenterY - (-1 * i * this.uvInterval * 10)], lineWidth, lineColor);
                this.renderText((dir * -1 * i / 10) + "", this.uvCenterX + 3, this.uvCenterY - (-1 * i * this.uvInterval * 10) - 5, fontSize, "rgb(15, 15, 15)");
            }

        },
        renderUv(): void {
            if (!this.uvDatas) return;
            if (this.uvSubMeshIndex < 0) return;
            if (this.uvSubUVIndex < 0) return;
            let subMeshIndex: number = this.uvSubMeshIndex;
            let subUVIndex: number = this.uvSubUVIndex;
            let subUVs: any[] = this.uvDatas["sub"];
            if (subMeshIndex < subUVs.length) {
                let uvs: any = subUVs[subMeshIndex]["uv"];
                if (subUVIndex < uvs.length) {
                    let uv: any = uvs[subUVIndex];
                    for (let i = 0; i < uv.length; i += 6) {
                        let a0: number = uv[i];
                        let b0: number = uv[i + 1];

                        let a1: number = uv[i + 2];
                        let b1: number = uv[i + 3];

                        let a2: number = uv[i + 4];
                        let b2: number = uv[i + 5];

                        let linePoint: number[] = [];
                        // let uvType = 0;
                        // if (uvType === 0) {
                        //     linePoint.push(this.uvCenterX + a0 * (this.uvInterval * 10 * 10));
                        //     linePoint.push(this.uvCenterY + b0 * (this.uvInterval * 10 * 10));
                        //     linePoint.push(this.uvCenterX + a1 * (this.uvInterval * 10 * 10));
                        //     linePoint.push(this.uvCenterY + b1 * (this.uvInterval * 10 * 10));
                        //     linePoint.push(this.uvCenterX + a2 * (this.uvInterval * 10 * 10));
                        //     linePoint.push(this.uvCenterY + b2 * (this.uvInterval * 10 * 10));
                        // } else {

                        // }
                        linePoint.push(this.uvCenterX + a0 * (this.uvInterval * 10 * 10));
                        linePoint.push(this.uvCenterY - b0 * (this.uvInterval * 10 * 10));
                        linePoint.push(this.uvCenterX + a1 * (this.uvInterval * 10 * 10));
                        linePoint.push(this.uvCenterY - b1 * (this.uvInterval * 10 * 10));
                        linePoint.push(this.uvCenterX + a2 * (this.uvInterval * 10 * 10));
                        linePoint.push(this.uvCenterY - b2 * (this.uvInterval * 10 * 10));
                        this.renderLine(linePoint, 0.35, 'rgb(255,255,255)');
                    }
                }
            }

        },
        renderLine(points: number[], lineWidth: number, color: string): void {
            this.uvContext.beginPath();
            this.uvContext.moveTo(points[0], points[1]);
            for (let i = 2; i < points.length; i += 2) {
                this.uvContext.lineTo(points[i], points[i + 1]);
            }
            this.uvContext.strokeStyle = color;
            this.uvContext.lineWidth = lineWidth;
            this.uvContext.closePath();
            this.uvContext.stroke();
        },
        renderText(text: string, x: number, y: number, fontSize: number, fontColor: string): void {
            this.uvContext.font = fontSize + 'px "微软雅黑"';
            this.uvContext.fillStyle = fontColor;
            this.uvContext.textBaseline = "top";
            this.uvContext.fillText(text, x, y);

        },
        closeUVPanel() {
            if (!this.isUV) return;
            this.isUV = false;
            window.removeEventListener('resize', this.onUVPanelChange)
            this.uvCanvas.removeEventListener('mousedown', this.canvasMouseTouchStart);
            this.uvCanvas.removeEventListener('mousemove', this.canvasMouseTouchMove);
            this.uvCanvas.removeEventListener('mouseup', this.canvasMouseTouchEnd);
            this.uvCanvas.removeEventListener("mousewheel", this.canvasMouseWheel);
        },
        /***************************uv 查看器* end*********************************** */
    },
});
const panelDataMap = new WeakMap() as WeakMap<object, InstanceType<typeof component>>;
/**
 * @zh 如果希望兼容 3.3 之前的版本可以使用下方的代码
 * @en You can add the code below if you want compatibility with versions prior to 3.3
 */
// Editor.Panel.define = Editor.Panel.define || function(options: any) { return options }
module.exports = Editor.Panel.define({
    listeners: {
        show() { console.log('show'); },
        hide() { console.log('hide'); },
    },
    template: readFileSync(join(__dirname, '../static/index.html'), 'utf-8'),
    style: readFileSync(join(__dirname, '../static/index.css'), 'utf-8'),
    $: {
        app: '#app',
    },
    methods: {
        hello() {
        },
    },
    ready() {
        if (this.$.app) {
            const vm = new component();
            panelDataMap.set(this, vm);
            vm.$mount(this.$.app);
        }
    },
    beforeClose() { },
    close() {
        const vm = panelDataMap.get(this);
        if (vm) {
            vm.$destroy();
        }
    },
});
