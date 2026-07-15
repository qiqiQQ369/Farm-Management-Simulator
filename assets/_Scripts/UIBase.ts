import { _decorator, Component, Node, log, Button, screen, Toggle, Label, Color, Sprite, ProgressBar, Canvas, view, macro, Vec3, Widget, Camera, geometry } from 'cc';
//import { Utils } from '../util/Utils';
// import { VoiceMgr } from '../util/VoiceMgr';
import { MainCamera } from './MainCamera';
// import { UiUtils } from '../../util/UiUtils';
const {ccclass, property} = _decorator;
const { Ray } = geometry;

export class UIBase extends Component {
    UiName:string;
    CanActiveNextLayer = true  //关闭时自动激活下一层UI
    mainCamera: Camera = null; // 摄像机属性，通过场景拖动赋值
    
    // 新增：当前语言属性（默认英文）
    currentLanguage: string = 'en';
    
    getHierarchy():UIHierarchy{
        return UIHierarchy.Normal;
    } 
    //第一次初始化。调用在onLoad之后，start之前。已经存在，每次展示都会调用
    onOpen(param)
    {
    }
    onClose()
    {
    }

    protected onLoad(): void {
        this.bindNode()
        const size = view.getVisibleSize(); // 获取可见区域尺寸
        this.LANDSCAPE = size.width >= size.height; // 横屏判断
        this.canvas = this.getComponent(Canvas); // 获取 Canvas 节点（未修改）
        // console.log(`设计分辨率: ${this.canvas.designResolution.width} x ${this.canvas.designResolution.height}`);
        // console.log(`适配参数: matchWidth=${this.canvas.matchWidth}, matchHeight=${this.canvas.matchHeight}`);
        // Register event listeners with the screen object
        screen.on('window-resize', this.onWindowResize, this);
        screen.on('orientation-change', this.onOrientationChange, this);
        screen.on('fullscreen-change', this.onFullScreenChange, this);

        
        // === 新增：环境语言检测逻辑 ===
        // 获取浏览器语言（可能返回类似"de-DE", "fr-FR", "zh-TW", "ja-JP", "en-US"等格式）
        const browserLang = navigator.language || navigator.languages?.[0] || 'en';
        const primaryLang = browserLang.split('-')[0].toLowerCase(); // 提取主语言代码

        // 检测目标语言（德语、法语、繁体中文、日文、英文）
        if (['de', 'fr', 'ja'].indexOf(primaryLang) !== -1) {
            this.currentLanguage = primaryLang;
        } else if (browserLang.includes('zh-TW') || browserLang.includes('zh-HK')) { // 繁体中文特殊处理
            this.currentLanguage = 'zh-tw';
        } else if (primaryLang === 'zh') { // 其他中文环境默认英文（用户需求）
            this.currentLanguage = 'en';
        } else {
            this.currentLanguage = 'en'; // 默认英文
        }
    }

    protected start(): void {
        // this.mainCamera = MainCamera.inst.getComponent(Camera); // 获取摄像机实例
    }

    //------------ui綁定處理
    @property({type:[Node]})
    arrBtns = []

    @property({type:[Node]})
    arrLabel = []

    @property({type:[Node]})
    arrSprite = []

    @property({type:[Node]})
    arrNodes = []

    @property({type:[Node]})
    arrToggles = []

    mapNodes:Map<string, Node> = new Map; //所有Node
    mapBtnEvents:Map<string,Function> = new Map;

    //注册绑定
    bindNode() {
        for (let i = 0; i < this.arrBtns.length; i++) {
            if(this.arrBtns[i] != null){
                let key = this.arrBtns[i].name
                UIBase.RegBtnEvt(this.arrBtns[i],()=>{
                    this.OnClick(key,this, this.arrBtns[i])
                },this)
                this.mapNodes.set(key,this.arrBtns[i])
            }
        }
        for (let i = 0; i < this.arrLabel.length; i++) {
            if(this.arrLabel[i] != null){
                let key = this.arrLabel[i].name
                this.mapNodes.set(key,this.arrLabel[i])
            }
        }
        for (let i = 0; i < this.arrSprite.length; i++) {
            if(this.arrSprite[i] != null){
                let key = this.arrSprite[i].name
                this.mapNodes.set(key,this.arrSprite[i])
            }
        }
        for (let i = 0; i < this.arrNodes.length; i++) {
            if(this.arrNodes[i] != null){
                let key = this.arrNodes[i].name
                this.mapNodes.set(key,this.arrNodes[i])
            }
        }
        for (let i = 0; i < this.arrToggles.length; i++) {
            if(this.arrToggles[i] != null){
                let nd =  this.arrToggles[i]
                let key = nd.name
                this.mapNodes.set(key,nd)
                UIBase.RegTogEvt(nd,()=>{
                    this.OnToggleClick(key,this, nd)
                },this)
            }
        }
    }

    toggleEvent:any
    //注册TogEvent
    RegToggleClick(callback:Function) {
        this.toggleEvent = callback
    }
        
    //Toggle点击
    OnToggleClick(name: string, ui: any, btn:Node) {
        log("点击Toggle " + name)
        if(this.toggleEvent)
        {
            let toggle = btn.getComponent(Toggle)
            this.toggleEvent(name,toggle,ui)
        }
    }

    //获取节点
    getNode(name:string):Node {
        return this.mapNodes.get(name)
    }

    //设置图片，保持原来的图片大小keepSize
    setSprite(name:string, imgPath:string, keepSize=true) {
        UIBase.SetSprite(this.getNode(name), imgPath, keepSize)
    }

    //设置文本
    setLabel(name:string, text:string) {
        UIBase.SetText(this.getNode(name), text)
    }

    setChildLabel(name:string, text:string, childpath:string) {
        UIBase.SetText(this.getNode(name), text, childpath)
    }


    //注册按键，不会重复注册的
    regClick(name:string, callback:Function) {
        this.mapBtnEvents.set(name, callback)
    }
    
    //按键点击
    OnClick(name: string, ui: any, btnNd:Node) {
        log("点击按钮 " + name)
        if(this.mapBtnEvents.has(name))
        {
            let btn = btnNd.getComponent(Button)
            this.mapBtnEvents.get(name)(ui,name,btn)
        }
        //点击音效
        //VoiceMgr.inst.playOneShot(("点击音效"), 1.0)
    }

    //变灰
    setGray(name:string, gray:boolean, colorGray:boolean, allChildren:boolean=true) {
        let node = this.getNode(name)
        UIBase.setNodeGray(node, gray, colorGray, allChildren)
    }

    static setNodeGray(node:Node, gray:boolean, colorGray:boolean, allChildren:boolean=true) {
        if(node == null) return
        let btn = node.getComponent(Button)
        if (btn != null) {
            btn.interactable = !gray
        }
        UIBase.setSpriteGray(node, gray, allChildren) //图片变灰
        
        let sp = node.getComponent(Sprite)  
        if(sp == null) return
        if (colorGray) {
            if(gray) {
                sp.color = Color.GRAY
            } else {
                sp.color = Color.WHITE
            }
        }
    }

    static setSpriteGray(node:Node, gray:boolean, allChildren:boolean) {
        let sp = node.getComponent(Sprite)  
        if(sp != null){
            if(gray) {
                sp.grayscale = true  
            } else {
                sp.grayscale = false  
            }
        }
        if (allChildren) {
            let children = node.children
            for (let i = 0; i < children.length; i++) {
                console.log(node.name+"/"+children[i].name)
                UIBase.setSpriteGray(children[i], gray, allChildren) //图片变灰
            } 
        }
    }

    static RegBtnEvt(node:Node,action:Function,target?:any, childpath:string=null)
    {
        let nd = node
        if (childpath != null) {
            nd = node.getChildByPath(childpath)
        }
        nd.on(Button.EventType.CLICK, (btn)=>{
            // VoiceMgr.inst.playOneShot("eAnniu")
            action(btn)
        },target)
    }

    static RegTogEvt(node:Node,action:Function,target?:any, childpath:string=null)
    {
        let togNode = node
        if (childpath != null) {
            togNode = node.getChildByPath(childpath)
        } 
        togNode.on(Toggle.EventType.TOGGLE,(togNode)=>{
            // VoiceMgr.inst.playOneShot("eAnniu")
            action(togNode)
        },target)
        // let tog = togNode.getComponent(ToggleComponent)
        // tog.clickEvents.r
    }

    //childpath:node下面的组件路径
    static SetText(node: Node | null, str: string, childpath: string | null = null): void {
        const target = childpath == null ? node : node?.getChildByPath(childpath);
        const label = target?.getComponent(Label);
        if (!label) {
            console.warn(`UIBase.SetText: missing Label at ${childpath ?? 'node'}`);
            return;
        }
        label.string = str;
    }

    static SetColor(node:Node,str:Color, childpath:string=null)
    {
        if (childpath == null) {
            node.getComponent(Sprite).color= str
        } else {
            node.getChildByPath(childpath).getComponent(Sprite).color= str
        }
    }
    
    //childpath:node下面的组件路径
    static SetProgress(node:Node,val:number, childpath:string=null)
    {
        if (childpath == null) {
            node.getComponent(ProgressBar).progress = val
        } else {
            node.getChildByPath(childpath).getComponent(ProgressBar).progress = val
        }
    }
    
    //childpath:node下面的组件路径
    static SetSprite(node:Node,path:string, keepSize=false,childpath:string=null)
    {
        if (childpath == null) {
            var s = node.getComponent(Sprite)
            //Utils.loadPicture(s, path.startsWith("http")?path:path+"/spriteFrame", keepSize)
        } else {
            var s = node.getChildByPath(childpath).getComponent(Sprite)
            //Utils.loadPicture(s, path.startsWith("http")?path:path+"/spriteFrame", keepSize)
        }
    }

    ////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////////////////////////////
    //横竖屏逻辑
    LANDSCAPE:boolean;
    canvas:Canvas;
    // 新增：设计分辨率（根据项目实际设计尺寸调整）
    private designWidth: number = 720; // 横屏设计宽度
    private designHeight: number = 1280; // 横屏设计高度

    // 新增：摄像机参数属性（横屏/竖屏状态）
    private cameraNormalPos: Vec3 = new Vec3();         // 横屏摄像机位置
    private cameraNormalRotation: Vec3 = new Vec3();    // 横屏摄像机旋转角度
    private cameraNormalOrtho: number = 4.8;             // 横屏正交投影高度
    private cameraHeightPos: Vec3 = new Vec3();         // 竖屏摄像机位置
    private cameraHeightRotation: Vec3 = new Vec3();    // 竖屏摄像机旋转角度
    private cameraHeightOrtho: number = 8;             // 竖屏正交投影高度
   // 新增：固定镜头标志位，非固定的是位置跟着人物在移动的。
   private isFixedCamera: boolean = false;  // 是否固定镜头（默认不固定）

    // 新增：屏幕变化回调（替代原freshUi）
    private onResizeCallback: ((width, height) => void) | null = null;

    // 新增：设置屏幕变化回调（带固定镜头参数）
    setResizeCallback(callback: (width, height) => void, isFixedCamera: boolean = false) {
        this.onResizeCallback = callback;
        this.isFixedCamera = isFixedCamera;  // 保存固定镜头状态
        setTimeout(() => {
            const screenSize = view.getVisibleSize();
            this.canvas.node.getComponent(Widget).left = -0.1;
            this.onWindowResize(screenSize.width, screenSize.height);
        }, 1000);
    }

    onWindowResize(width: number, height: number) {
        console.log("Window resized:", width, height);
        this.LANDSCAPE = (width >= height) // 横屏
        this.updateCanvasScale(); // 全屏变化时更新缩放
    }
    
    onOrientationChange(orientation: number) {
        if (orientation === macro.ORIENTATION_LANDSCAPE_LEFT || orientation === macro.ORIENTATION_LANDSCAPE_RIGHT) {
          console.log("Orientation changed to landscape:", orientation);
          this.LANDSCAPE = true;
        } else {
          console.log("Orientation changed to portrait:", orientation);
          this.LANDSCAPE = false;
        }
        this.updateCanvasScale(); // 全屏变化时更新缩放
    }
    
    onFullScreenChange(width: number, height: number) {
        console.log("Fullscreen change:", width, height);
        this.LANDSCAPE = (width >= height) // 横屏
        this.updateCanvasScale(); // 全屏变化时更新缩放
    }
    
    // 新增：计算并应用Canvas缩放
    public updateCanvasScale() {
        const screenSize = view.getVisibleSize();
        let scale: number;
        // let mainCamera = this.canvas.cameraComponent; 
        if (this.mainCamera == null) {
            this.mainCamera = MainCamera.inst.getComponent(Camera); // 获取摄像机实例
        }
        if (this.LANDSCAPE) { 
            // 横屏：适配高度（原逻辑）
            scale = screenSize.height / this.designWidth;
            // 应用缩放（确保UI整体按比例缩放）
            this.canvas.node.setScale(scale, scale);

            // this.canvas.node.setScale(1, 1);
            // 仅固定镜头时设置摄像机参数
            if(this.isFixedCamera) {
                this.mainCamera.node.setPosition(this.cameraNormalPos); // 横屏正常视角
                //this.mainCamera.node.setRotation(this.cameraNormalRotation); // 横屏正常角度
                this.mainCamera.node.eulerAngles = this.cameraNormalRotation;// 横屏正常角度
            }
            //相机的处理
            this.mainCamera.orthoHeight = this.cameraNormalOrtho; // 横屏正交相机高度
        } else { 
            // 竖屏：适配宽度（新增逻辑）
            // scale = screenSize.width / this.designHeight;
            // // 应用缩放（确保UI整体按比例缩放）
            // this.canvas.node.setScale(scale, scale);

            this.canvas.node.setScale(1, 1);
            // 仅固定镜头时设置摄像机参数
            if(this.isFixedCamera) {
                this.mainCamera.node.setPosition(this.cameraHeightPos); // 竖屏正常视角  
                this.mainCamera.node.eulerAngles = this.cameraHeightRotation;// 竖屏正常角度
            }
            //相机的处理
            this.mainCamera.orthoHeight = this.cameraHeightOrtho; // 竖屏正交相机高度
            
        }
        console.log(`屏幕分辨率: ${screenSize.width} x ${screenSize.height}`,",this.LANDSCAPE=", this.LANDSCAPE,",ortho=", this.mainCamera.orthoHeight);
        if(this.onResizeCallback) this.onResizeCallback(screenSize.width, screenSize.height);  // 替换原freshUi调用
    }

    //将一个场景世界坐标转成ui的世界坐标
    scenePosToUiWdPos(pos:Vec3):Vec3{
        let mainCamera = MainCamera.inst.curCamera // 获取摄像机实例
        // 将世界坐标转换为 UI 坐标
        let scrPos = mainCamera.worldToScreen(pos);
        const uiPos = this.canvas.cameraComponent.screenToWorld(scrPos);
        return uiPos
    }

    //将一个ui的世界坐标转成场景的世界坐标
    uiWdPosToScenePos(pos:Vec3, worldObj:Node=null){
        // 将世界坐标转换为 UI 坐标
        let scrPos = this.canvas.cameraComponent.worldToScreen(pos);
        //老的，但是在场景里面位置会不对。
        // const sPos = this.mainCamera.screenToWorld(scrPos);// uiNode.convertToNodeSpaceAR(uiPos);
        //新的 2. 生成射线（需显式创建Ray实例）
        const ray = new Ray(); // 初始化射线对象
        this.mainCamera.screenPointToRay(scrPos.x, scrPos.y, ray); // 填充射线信息
        // 3. 避免direction.y为0导致除零错误
        if (Math.abs(ray.d.y) < 1e-6) {
            console.warn("射线方向与Y轴平行，无法计算交点");
            return;
        }

        //根据固定的y坐标，来算出x和z，就能确定三维坐标。
        const dsetY = worldObj.worldPosition.y;
        // 4. 计算射线与y=coinDsetY平面的交点参数t
        const t = (dsetY - ray.o.y) / ray.d.y;
        const intersectPos = new Vec3(
            ray.o.x + ray.d.x * t,
            dsetY, // 固定Y坐标
            ray.o.z + ray.d.z * t
        );
    }
}

//ui的层级
export enum UIHierarchy {
    Normal, //一般ui都放这里
    Pop,  //一些久居上层的放这里.新手引导的界面可能就放这里了
    Top //加载界面之类的顶级ui
}
