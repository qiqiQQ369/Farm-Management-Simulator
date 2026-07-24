import { _decorator, Camera, Animation, EventTouch, Input, Label, Node, Sprite, tween, Tween, UITransform, Vec2, Vec3, view, Widget } from 'cc';
//import { Joystick } from './Joystick';
import { UIBase } from './UIBase';
// import { PlayerController } from '../manager/PlayerController';
import { MainCamera } from './MainCamera';
// import { SceneManager } from '../manager/SceneManager';
// import { GameFlowManager, GameState } from '../manager/GameFlowManager';
// import { VoiceMgr } from '../util/VoiceMgr';
const { ccclass, property } = _decorator;

@ccclass('MainUI')
export class MainUI extends UIBase {
    // 新增静态实例引用
    public static inst: MainUI;
    // 绑定UI节点（需在编辑器中关联）
    moveHit: Node = null!;  // 摇杆提示节点
    //movePanel: Node = null!;  // 摇杆面板节点

    private noTouchTime: number = 0;  // 无触摸计时
    private isTouching: boolean = false;  // 当前是否在触摸
    // private joystick: Joystick;  // 摇杆脚本实例
    // private playerCtrl: PlayerController;  // 玩家控制脚本实例

    //progressCircle: Node = null!;  // 新增：圆形进度条节点
    // private fillTween: Tween<Sprite> | null = null;  // 新增：存储填充动画实例
    // private fillCallback: (() => void) | null = null;  // 新增：存储填充完成回调

    //numberShow: Node = null!;  // 新增：数字显示节点
    //private peopleLabel: Label = null!;  // 新增：数字显示的Label组
    
    //winShow: Node = null!;
    //moneyAdd: Node = null!;  // 需在编辑器绑定

    //money:number = 0;  // 新增：当前金钱
    isGameOver: boolean;
    // 新增：ViewCar状态计时器（用于间隔触发）
    private viewCarTimer: number = 0;
    // 新增：ViewCar状态下的间隔时间（1秒）
    private viewCarInterval: number = 1.5;

    protected onLoad(): void {
        super.onLoad();
        // 初始化静态实例（防止重复创建）
        if (MainUI.inst) {
            console.error("MainUI实例已存在，请勿重复创建");
            this.destroy();
            return;
        }

        MainUI.inst = this;
        this.moveHit = this.getNode("moveHit");  // 获取摇杆提示节点
        //this.movePanel = this.getNode("movePanel");  // 获取摇杆面板节点
        
        // 获取脚本实例
        // this.joystick = this.movePanel.getComponent(Joystick)!;
        // 初始化状态
        this.moveHit.active = true;
        //this.movePanel.active = false;
        // 注册全局触摸事件
        this.node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        // ... 原有初始化逻辑 ...
        // this.progressCircle = this.getNode("progressCircle");  // 获取进度条节点，假设其名为progressU
        // this.progressCircle.active = false;  // 初始隐藏进度条

        //人数显示
        //this.numberShow = this.getNode("peopleNum");  // 获取数字显示节点，假设其名为numberShowU
        // 新增：获取子节点的Label组件（假设子节点名为"Label"）
        //this.peopleLabel = this.numberShow.getComponentInChildren(Label)!;

        // 初始化胜利提示节点（隐藏）
        //this.winShow = this.getNode("winShow");
        //this.winShow.active = false;

        //this.moneyAdd = this.getNode("moneyShow");  // 需在编辑器绑定
        //this.moneyAdd.active = false;

        this.freshLange()
    }

    freshLange() {
        let btnString = "Play Now";
        // this.currentLanguage = 'ja'
        switch(this.currentLanguage) {
            case 'fr': {
                btnString = "Jouer Maintenant";  // 更新按钮显示
                break;
            }
            case 'de': {
                btnString = "Spiele Jetzt";  // 更新按钮显示
                break;
            }
            case 'zh-tw': {
                btnString = "開始遊戲";  // 更新按钮显示
                break;
            }
            case 'ja': {
                btnString = "ゲームを始める";  // 更新按钮显示
                break;
            }
        }
        this.setChildLabel("btnWin", btnString, "Label");  // 更新按钮显示
        this.setChildLabel("btnGo", btnString, "Label");  // 更新按钮显示
    }


    // 隐藏移动相关UI
    public hideMoveUI() {
        this.moveHit.active = false;
        //this.movePanel.active = false;
        // this.numberShow.active = false;
    }

    // 显示移动相关UI
    public showMoveUI() {
        this.moveHit.active = true;
        //this.movePanel.active = false;
        // this.numberShow.active = true;
    }
    // 新增：开始填充进度条（参数为填充完成回调）
    // startFilling(triggerNode: Node, callback: () => void) {
    //     this.updateProgressCirclePos(triggerNode);  // 更新进度条位置
    //     this.progressCircle.active = true;
    //     this.fillCallback = callback;
    //     const sprite = this.progressCircle.children[2].getComponent(Sprite)!;
    //     sprite.fillRange = 0;  // 重置填充进度
    //     this.fillTween?.stop();  // 停止当前动画（如果存在）

    //     // 使用tween实现2秒顺时针填充
    //     this.fillTween = new Tween(sprite)
    //         .to(0.75, { fillRange: 1 }, { easing: 'linear' })
    //         .call(() => {  // 填充完成
    //             this.progressCircle.active = false;
    //             this.fillCallback?.();  // 执行回调
    //             this.fillCallback = null;
    //         })
    //         .start();
    // }

    // // 新增：停止填充并隐藏进度条（中途离开时调用）
    // stopFilling() {
    //     this.fillTween?.stop();  // 停止当前动画
    //     this.progressCircle.active = false;
    //     this.fillCallback = null;  // 清除回调（不执行）
    // }

    // 新增：更新进度条位置的方法
    updateProgressCirclePos(triggerNode: Node) {
        // 1. 获取触发节点的世界坐标
        const worldPos = triggerNode.worldPosition;
        
        // 2. 世界坐标 → 屏幕坐标（使用主相机）
        const screenPos = new Vec3();
        const camera = MainCamera.inst.curCamera!;
        camera.worldToScreen(worldPos, screenPos);

        // 3. 屏幕坐标 → UI节点本地坐标（使用MainUI的UITransform）
        const screenWorldPos = this.canvas.cameraComponent.screenToWorld(screenPos);
        // const uiTransform = MainUI.inst.node.getComponent(UITransform)!;
        // const localPos = uiTransform.convertToNodeSpaceAR(screenPos);

        // 4. 设置进度条位置
       // MainUI.inst.progressCircle.setWorldPosition(screenWorldPos);
    }

    start() {
        //this.playerCtrl = PlayerController.inst;
        // this.setLabel("LabelMoney", this.money.toString());  // 更新UI显示
        this.regClick("btnGo", () => {  // 注册开始按钮点击事件
            this.goUrl();
        });

        //诙谐BGM
        //VoiceMgr.inst.playMusic("诙谐BGM")
        this.setResizeCallback((width, height) => {  // 注册窗口大小变化回调
            // 重新计算并更新进度条位置（如果需要）
            if(this.LANDSCAPE) {
                this.getNode("moveHit").getComponent(Widget).horizontalCenter = width/12;  // 重置水平居中
            } else {
                this.getNode("moveHit").getComponent(Widget).horizontalCenter = 0;  // 重置水平居中
            }
        });
    }

    goUrl() {
        var urlgoogle = "https://play.google.com/store/apps/details?id=com.monopoly.dream.idle.king&hl=en_Uk&gl=uk"
        var urlapple ="https://apps.apple.com/gb/app/top-tycoon-coin-theme-empire/id6739124364"
        // 检测是否为苹果设备（iOS）
        const userAgent = navigator.userAgent.toLowerCase();
        const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);

        // 根据环境选择跳转链接
        const targetUrl = isAppleDevice ? urlapple : urlgoogle;
        // window.open(targetUrl, '_blank');  // 打开新页面
        // 修改：使用location.href直接跳转（避免手机浏览器拦截window.open）
        // window.location.href = targetUrl;
        //mraid.open(targetUrl);
    }

    update(deltaTime: number) {
        if (MainUI.inst.isGameOver) return;  // 暂停状态下不处理

        // 新增：ViewCar状态间隔加钱逻辑
        // if (GameFlowManager.inst.currentState === GameState.ViewCar) {
        //     this.viewCarTimer += deltaTime;
        //     if (this.viewCarTimer >= this.viewCarInterval) {
        //         this.viewCarTimer = 0;  // 重置计时器
        //         this.addViewCarMoney();  // 执行加钱逻辑
        //     }
        // }

        if (!this.isTouching) {
            // ViewCar状态下禁止处理触摸
            //if (GameFlowManager.inst.currentState === GameState.ViewCar) return;

            this.noTouchTime += deltaTime;
            // 3秒无触摸显示提示
            if (this.noTouchTime >= 3) {
                this.moveHit.active = true; // ViewCar状态下禁止处理触摸
            }
        }
        // 新增：如果场景管理器存在且目标节点有效，更新数字位置
        // if (SceneManager.inst && SceneManager.inst.nodenumberPos) {
        //     this.updateNumberShowPosition();
        // }
    }

    // 新增：ViewCar状态下的加钱逻辑
    private addViewCarMoney() {
        // 获取当前关卡轨道控制器
        // const trackCtrl = SceneManager.inst.getCurrentLevelTrackController();
        // if (!trackCtrl || trackCtrl.carControllers.length === 0) return;

        // // 获取第一个车辆的世界坐标
        // const firstCarNode = trackCtrl.carControllers[0].node;
        // const carWorldPos = firstCarNode.worldPosition;
        // 获取屏幕中心坐标（屏幕空间）
        const canvasSize = view.getVisibleSize();//this.canvas.getComponent(UITransform)!.contentSize;
        const screenCenter = new Vec3(canvasSize.width / 2, canvasSize.height / 2, 0);
        console.log("screenCenter:", screenCenter);
        // 调用加钱动画（金额5）
        //this.showMoneyAnimation(5, screenCenter);
    }

    // 新增：更新数字显示位置（锁定到nodenumberPos）
    private updateNumberShowPosition() {
        // 1. 获取目标节点的世界坐标
        //const targetWorldPos = SceneManager.inst.getNumberTargetWorldPos();

        // 2. 世界坐标 → 屏幕坐标（使用主相机）
        const screenPos = new Vec3();
        const mainCamera = MainCamera.inst.curCamera!;
        //mainCamera.worldToScreen(targetWorldPos, screenPos);

        // 3. 屏幕坐标 → UI本地坐标（基于Canvas）
        const screenWorldPos = this.canvas.cameraComponent.screenToWorld(screenPos);
        // const canvasUITransform = this.canvas.node.getComponent(UITransform)!;
        // const localPos = canvasUITransform.convertToNodeSpaceAR(screenPos);

        // 4. 设置数字显示位置并显示
        // this.numberShow.setWorldPosition(screenWorldPos.add(new Vec3(0, 0, 0)));  // Z轴偏移100
    }
    // 新增：设置当前人数的方法
    public setPeopleNumber(num: string) {
        // if (this.peopleLabel) {
        //     this.peopleLabel.string = num;  // 设置Label文本
        // }
    }

    // 触摸开始处理
    private onTouchStart(event: EventTouch) {
        // this.addViewCarMoney();

        if (MainUI.inst.isGameOver) return;  // 暂停状态下不处理
        // ViewCar状态下禁止处理触摸
        //if (GameFlowManager.inst.currentState === GameState.ViewCar) return;
        
        this.isTouching = true;
        this.noTouchTime = 0;  // 重置计时
        // 隐藏提示，显示摇杆
        this.moveHit.active = false;
        //this.movePanel.active = true;
        // 传递初始触摸位置给摇杆（可选）
        const touchPos = event.getLocation();
        //this.joystick.onTouchStart(touchPos);
        
        // 1. 屏幕坐标 → UI相机世界坐标
        const worldPos = new Vec3();
        this.canvas.cameraComponent.screenToWorld(new Vec3(touchPos.x, touchPos.y, 0), worldPos);

        // 2. 世界坐标 → 当前UI节点本地坐标
        const uiTransform = this.node.getComponent(UITransform)!;
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos);

        // 设置摇杆位置
        //this.movePanel.setPosition(localPos);
    }

    // 触摸移动处理
    private onTouchMove(event: EventTouch) {
        if (MainUI.inst.isGameOver) return;  // 暂停状态下不处理
        // ViewCar状态下禁止处理触摸
        //if (GameFlowManager.inst.currentState === GameState.ViewCar) return;

        const touchPos = event.getLocation();
        const worldPos = this.canvas.cameraComponent.screenToWorld(new Vec3(touchPos.x, touchPos.y, 0))
        // console.log("touchPos:", touchPos, ",wp:",worldPos);
        // 获取摇杆方向（由Joystick脚本计算）
        //const direction = this.joystick.onTouchMove(worldPos);
        // 传递方向给玩家控制器
        // if (direction) {
        //     //this.playerCtrl.move(direction);
        // }
    }

    // 触摸结束处理
    private onTouchEnd(event: EventTouch) {
        this.isTouching = false;
        //this.movePanel.active = false;
        // 摇杆复位（由Joystick脚本处理）
        // this.joystick.onTouchEnd();
        // // 玩家停止移动
        // this.playerCtrl.stop();

    }

    protected onDestroy(): void {
        // 移除事件监听
        this.node.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }


    // 显示加钱动画（金额，玩家世界坐标）
    // showMoneyAnimation(amount: number, screenPos: Vec3) {
    //     const label = this.moneyAdd.getComponentInChildren(Label);
    //     if (!label) return;

    //     // 初始化状态
    //     label.node.active = true;  // 确保文本节点可见
    //     this.moneyAdd.active = true;
    //     this.moneyAdd.scale = new Vec3(1, 1, 1);
    //     label.string = `+${amount}`;  // 设置金额文本

    //     const uiTransform = this.node.getComponent(UITransform)!;
    //     const uiPos = uiTransform.convertToNodeSpaceAR(screenPos);
    //     // console.log("screenPos:", screenPos, ",wp:",wp,",uiPos:",uiPos);  // 打印屏幕坐标
    //     // 设置到玩家头顶位置（Y轴偏移+2）
    //     this.moneyAdd.setPosition(uiPos.x+60, uiPos.y + 70, 0);

    //     // 播放淡入+放大动画
    //     tween(this.moneyAdd)
    //         .to(0.4, {scale: new Vec3(1.2, 1.2, 1) }, { easing: 'quadOut' })
    //         .call(() => {
    //             label.node.active = false;  // 隐藏金额文本
    //             const moneyPosNode = this.getNode("moneypos");
    //             // 飞向moneyPos节点
    //             const targetPos = moneyPosNode.worldPosition;//this.node.getComponent(UITransform)?.convertToNodeSpaceAR(moneyPosNode.worldPosition) || new Vec3();
    //             tween(this.moneyAdd)
    //                 .to(0.4, { worldPosition: targetPos, scale: new Vec3(0.2, 0.2, 1) }, { easing: 'quadOut' })
    //                 .call(() => {
    //                     this.moneyAdd.active = false;  // 最终隐藏
    //                     this.addMoney(amount);  // 增加金钱
    //                     // this.money += amount;  // 更新总金额
    //                     // this.setLabel("LabelMoney", this.money.toString());  // 更新UI显示
    //                     // 播放缩放动画
    //                     tween(moneyPosNode)
    //                         .to(0.2, { scale: new Vec3(1.5, 1.5, 1) })
    //                         .to(0.2, { scale: new Vec3(1, 1, 1) })
    //                         .call(() => {
    //                         })
    //                         .start();
    //                     //播放音效 获得金币
    //                    // VoiceMgr.inst.playOneShot("获得金币");  
    //                 })
    //                 .start();
    //         })
    //         .start();
    // }

    // addMoney(amount: number) {
    //     this.money += amount;  // 更新总金额
    //     this.setLabel("LabelMoney", this.money.toString());  // 更新UI显示
    //     return this.money;  // 返回当前总金额
    // }
    
    // finishGame() {
    //     this.getNode("logo").active = false;  // 隐藏logo
    //     this.getNode("finger").active = false;  // 隐藏logo
    //     this.winShow.active = true;
    //     this.isGameOver = true;
    //     this.hideMoveUI();  // 隐藏移动相关UI
    //     const animation = this.winShow.getComponent(Animation)
    //     animation.play();  // 播放胜利动画
    //     animation.once(Animation.EventType.FINISHED, () => {  // 监听动画停止事件，'stop' 通常是符合 _cocos_animation_animation_state__EventType 类型的事件
    //         this.getNode("finger").active = true;
    //     });
    // }
}


