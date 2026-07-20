import { _decorator, Component, Node, Vec3, Camera, tween, Tween, find, Animation, RigidBody } from 'cc';
import { CameraController } from './CameraController';
import { MainUI } from './MainUI';
import { AnimationName, PlayerController } from './PlayerController';
import { JoystickController } from './JoystickController';
import { ResourceFieldSystem } from './ResourceFieldSystem';
import { HaulerNPC } from './HaulerNPC';
const { ccclass, property } = _decorator;

/**
 * 完成节点脚本
 * 控制节点激活、缩放动画和摄像机移动
 */
@ccclass('FinishNode')
export class FinishNode extends Component {
    
    @property({ type: [Node], tooltip: "需要激活的节点列表" })
    public targetNodes: Node[] = [];
    
    @property({ tooltip: "节点激活间隔时间（秒）" })
    public nodeActivateInterval: number = 0.5;
    
    @property({ tooltip: "节点缩放动画持续时间（秒）" })
    public scaleAnimationDuration: number = 1.0;
    
    @property({ tooltip: "节点初始缩放值" })
    public initialScale: number = 0.1;
    
    @property({ tooltip: "节点最终缩放值" })
    public finalScale: number = 1.0;
    
    @property({ type: Camera, tooltip: "摄像机组件" })
    public camera: Camera = null!;
    
    @property({ type: Node, tooltip: "摄像机起点位置" })
    public cameraStartPoint: Node = null!;
    
    @property({ type: Node, tooltip: "摄像机终点位置" })
    public cameraEndPoint: Node = null!;
    
    @property({ tooltip: "摄像机移动持续时间（秒）" })
    public cameraMoveDuration: number = 3.0;
    
    @property({ tooltip: "摄像机移动延迟时间（秒）" })
    public cameraMoveDelay: number = 2.0;
    
    @property({ tooltip: "是否自动开始" })
    public autoStart: boolean = true;
    
    @property({ tooltip: "是否循环播放" })
    public loop: boolean = false;

    @property({ type: Node, tooltip: "chache" })
    public chache: Node = null!;

    @property({ type: Node, tooltip: "node1" })
    public node1: Node = null!;
    @property({ type: Node, tooltip: "node2" })
    public node2: Node = null!;
    @property({ type: Node, tooltip: "node3" })
    public node3: Node = null!;

    @property({ type: Node, tooltip: "tableNode" })
    public tableNode: Node = null!;
    
    // 私有属性
    private _isPlaying: boolean = false;
    private _currentNodeIndex: number = 0;
    private _nodeActivateTimer: number = 0;
    private _cameraMoveTimer: number = 0;
    private _cameraMoveStarted: boolean = false;
    private _cameraOriginalPosition: Vec3 = new Vec3();
    private _cameraOriginalRotation: Vec3 = new Vec3();
    
    // 事件回调
    public onNodeActivated: ((node: Node, index: number) => void) | null = null;
    public onCameraMoveStarted: (() => void) | null = null;
    public onCameraMoveCompleted: (() => void) | null = null;
    public onAllCompleted: (() => void) | null = null;

    protected onLoad(): void {
        // 保存摄像机原始位置和旋转
        if (this.camera) {
            this._cameraOriginalPosition = this.camera.node.position.clone();
            this._cameraOriginalRotation = this.camera.node.eulerAngles.clone();
            this.camera.getComponent(CameraController).enabled = false;
        }
        
        // 初始化所有目标节点
        //this.initializeTargetNodes();
    }

    start() {
        if (this.autoStart) {
            this.startFinishSequence();
            MainUI.inst.isGameOver = true;
        }
    }

    protected update(deltaTime: number): void {
        if (!this._isPlaying) return;
        
        // 处理节点激活计时器
        this._nodeActivateTimer += deltaTime;
        if (this._nodeActivateTimer >= this.nodeActivateInterval) {
            this._nodeActivateTimer = 0;
            //this.activateNextNode();
        }
        
        // 处理摄像机移动计时器
        if (this._cameraMoveStarted) {
            this._cameraMoveTimer += deltaTime;
            if (this._cameraMoveTimer >= this.cameraMoveDuration) {
                this.onCameraMoveComplete();
            }
        }
    }

    /**
     * 初始化目标节点
     */
    private initializeTargetNodes(): void {
        // for (const node of this.targetNodes) {
        //     if (node && node.isValid) {
        //         // 设置初始状态：非激活、缩放为0
        //         node.active = false;
        //         node.setScale(this.initialScale, this.initialScale, this.initialScale);
        //     }
        // }
        
        // console.log(`初始化了 ${this.targetNodes.length} 个目标节点`);
    }

    /**
     * 开始完成序列
     */
    public startFinishSequence(): void {
        if (this._isPlaying) {
            console.warn('完成序列已在播放中');
            return;
        }
        
        this._isPlaying = true;
        this._currentNodeIndex = 0;
        this._nodeActivateTimer = 0;
        this._cameraMoveTimer = 0;
        this._cameraMoveStarted = false;
        
        console.log('开始完成序列');
        
        // 开始激活第一个节点
        this.activateNextNode();
        this.startCameraMove();

        const joystickController = find('Canvas/JoystickContainer').getComponent(JoystickController);
        joystickController._lock = true;
        joystickController.node.active = false;
    }

    /**
     * 激活下一个节点
     */
    private activateNextNode(): void {

        var delay = 0.5;
        var targetNode = this.targetNodes[0];

        tween(this.targetNodes[1])
        .to(0.2, { scale: new Vec3(1, 1, 1)})
        .start();

        for(var i = 0; i < targetNode.children.length / 4; i++){

            const index = i;
            tween(targetNode)
            .delay(delay + index * 0.2)
            .call(() => {
                targetNode.children[index * 4].active = true;
                targetNode.children[index * 4 + 1].active = true;
                targetNode.children[index * 4 + 2].active = true;
                targetNode.children[index * 4 + 3].active = true;
            })
            .start();

            // this.targetNodes[i].active = true;
            // this.targetNodes[i].setScale(this.finalScale, this.finalScale, this.finalScale);
            // this.scheduleOnce(() => {
            //     this.targetNodes[i].active = false;
            // }, delay);
        }

        // if (this._currentNodeIndex >= this.targetNodes.length) {
        //     // 所有节点都已激活，开始摄像机移动
        //     //this.startCameraMove();
        //     return;
        // }
        
        // const node = this.targetNodes[this._currentNodeIndex];
        // if (node && node.isValid) {
        //     // 激活节点
        //     node.active = true;

        //     // 播放缩放动画
        //     // this.playScaleAnimation(node);
            
        //     // 触发事件
        //     this.onNodeActivated?.(node, this._currentNodeIndex);
            
        //     console.log(`激活节点 ${this._currentNodeIndex + 1}/${this.targetNodes.length}: ${node.name}`);
            
        //     this._currentNodeIndex++;
        // } else {
        //     // 跳过无效节点
        //     this._currentNodeIndex++;
        //     this.activateNextNode();
        // }
    }

    /**
     * 开始摄像机移动
     */
    private startCameraMove(): void {
        if (!this.camera || !this.cameraStartPoint || !this.cameraEndPoint) {
            console.warn('摄像机或路径点未设置，跳过摄像机移动');
            this.onAllCompleted?.();
            return;
        }
        
        console.log('开始摄像机移动');
        
        // 延迟开始摄像机移动
        this.scheduleOnce(() => {
            this.executeCameraMove();
        }, this.cameraMoveDelay);
    }

    /**
     * 执行摄像机移动
     */
    private executeCameraMove(): void {
        if (!this.camera || !this.cameraStartPoint || !this.cameraEndPoint) return;
        
        this._cameraMoveStarted = true;
        this._cameraMoveTimer = 0;
        
        // 设置摄像机到起点位置和起始角度
        this.camera.node.setWorldPosition(this.cameraStartPoint.worldPosition);
        this.camera.node.setWorldRotation(this.cameraStartPoint.worldRotation);

        // 终点摄像机始终朝向解锁区域中心，避免玉米田偏出画面。
        const fieldCenter = this.getUnlockFieldCenter();
        const lookAtNode = new Node('FinishCameraLookAt');
        lookAtNode.setWorldPosition(this.cameraEndPoint.worldPosition);
        lookAtNode.lookAt(fieldCenter, Vec3.UP);
        const endRotation = lookAtNode.worldRotation.clone();
        lookAtNode.destroy();
        
        // 触发事件
        this.onCameraMoveStarted?.();
        
        console.log('摄像机开始移动');
        
        // 创建摄像机移动动画
        tween(this.camera.node)
            .to(this.cameraMoveDuration, {
                position: this.cameraEndPoint.worldPosition,
                rotation: endRotation
            }, {
                easing: 'sineInOut' // 使用正弦缓动效果
            })
            .call(() => {
                this.onCameraMoveComplete();
            })
            .start();
    }

    /** 计算当前解锁区域（玉米田）的世界坐标中心。 */
    private getUnlockFieldCenter(): Vec3 {
        const field = this.targetNodes?.[0];
        if (!field || field.children.length === 0) {
            return field ? field.worldPosition.clone() : this.cameraEndPoint.worldPosition.clone();
        }

        const center = new Vec3();
        for (const child of field.children) {
            center.add(child.worldPosition);
        }
        center.multiplyScalar(1 / field.children.length);
        return center;
    }

    /**
     * 摄像机移动完成
     */
    private onCameraMoveComplete(): void {
        this._cameraMoveStarted = false;
        
        // 触发事件
        this.onCameraMoveCompleted?.();
        
        console.log('摄像机移动完成');
        
        // 完成整个序列
        //this.onSequenceComplete();

        this.node2.active = true;

        // Gameplay nodes must appear before optional reveal decorations run.
        if (ResourceFieldSystem.notifyFieldRevealCompleted(this.node.parent ?? this.node)) {
            this._isPlaying = false;
            return;
        }

        tween(this.node1)
        .to(0.2, { scale: new Vec3(1, 1, 1) })
        .call(() => {
            
            tween(this.node3)
            .to(0.2, { scale: new Vec3(1, 1, 1) })
            .call(async () => {

                //player.getComponent(RigidBody).setLinearVelocity(new Vec3(0, 0, 0));
                var player = find('Player');
                var playerController = player.getComponent(PlayerController);
                playerController.enabled = false;
                // player.active = false;
                // this.chache.active = true;
                // this.chache.setWorldPosition(player.worldPosition);
                
                var targetPosition = this.node1.worldPosition.clone();
                targetPosition.y = 0;

                playerController.playAnimation(AnimationName.Run);
                player.lookAt(targetPosition);

                tween(player)
                .to(1, { position: targetPosition })
                .call(() => {
                    playerController.playAnimation(AnimationName.Idle);
                    player.eulerAngles = new Vec3(0, 180, 0);
                })
                .start();

                tween(this.tableNode)
                .delay(0.7)
                .call(() => {
                    this.tableNode.getChildByName("gray").active = false;
                    this.tableNode.getChildByName("red").active = true;
                    this.tableNode.getChildByName("锁").getComponent(Animation).play("ani_锁_开锁");
                })
                .start();

                await new Promise(resolve => setTimeout(resolve, 300));
                this.scheduleOnce(() => {
                    this.restoreGameplayAfterSequence(player, playerController);
                }, 1.7);
        
            })
            .start();
        })
        .start();
    }

    private restoreGameplayAfterSequence(player: Node, playerController: PlayerController): void {
        this.recoverForestHaulerAfterReveal();

        // The two side fields report completion here, after their existing reveal
        // camera/activation sequence. The second report means the third total
        // resource field is open and the existing EndPanel becomes authoritative.
        if (ResourceFieldSystem.notifyFieldRevealCompleted(this.node.parent ?? this.node)) {
            return;
        }

        const joystickController = find('Canvas/JoystickContainer').getComponent(JoystickController);
        joystickController._lock = false;
        joystickController.node.active = true;

        playerController.enabled = true;

        if (MainUI.inst) {
            MainUI.inst.isGameOver = false;
        }

        if (this.camera) {
            const cameraController = this.camera.getComponent(CameraController);
            if (cameraController) {
                this.camera.node.setPosition(this._cameraOriginalPosition);
                this.camera.node.eulerAngles = this._cameraOriginalRotation.clone();
                cameraController.enabled = true;
                cameraController.setTarget(player);
                cameraController.snapToTarget();
            }
        }

        this._isPlaying = false;
        this.onAllCompleted?.();
    }

    /** Keep the original forest hauler state machine, but discard reveal-stale state. */
    private recoverForestHaulerAfterReveal(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }

        const forestHauler = scene.getComponentsInChildren(HaulerNPC)
            .find(hauler => hauler.node.name === 'HaulerNPC');
        forestHauler?.recoverAfterSceneTransition();
    }

    /**
     * 序列完成
     */
    // private onSequenceComplete(): void {
    //     this._isPlaying = false;
        
    //     // 触发完成事件
    //     this.onAllCompleted?.();
        
    //     console.log('完成序列结束');
        
    //     // 如果启用循环，重新开始
    //     if (this.loop) {
    //         this.scheduleOnce(() => {
    //             this.resetAndRestart();
    //         }, 2.0);
    //     }
    // }
}
