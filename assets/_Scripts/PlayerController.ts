import { _decorator, Component, Node, Vec3, input, Input, EventKeyboard, 
    KeyCode, CharacterController, RigidBody, math, ICollisionEvent, Collider, ITriggerEvent, SkeletalAnimation, Animation, AnimationState } from 'cc';
import { IJoystickInput, JoystickController } from './JoystickController';
import { TreeManager } from './TreeManager';
import { ChopAction } from './ChopAction';
import { CameraController } from './CameraController';
import { WoodBackpack } from './WoodBackpack';
import { ArrowTipController } from './ArrowTipController';
const { ccclass, property } = _decorator;


export enum AnimationName {
    Idle = "idle1_FuTou",
    Run = "run2_FuTou",
    Chop = "KanMuTou"
}

/**
 * 玩家控制器
 * 负责处理玩家角色的移动、旋转和基本交互
 * 支持键盘和虚拟摇杆双重输入
 */
@ccclass('PlayerController')
export class PlayerController extends Component implements IJoystickInput {

    @property({ type: Node, tooltip: "玩家角色节点" })
    public playerNode: Node = null!;
    
    @property({ tooltip: "移动速度" })
    public moveSpeed: number = 5.0;
    
    @property({ tooltip: "旋转速度（度/秒）" })
    public rotationSpeed: number = 540.0;
    
    @property({ tooltip: "是否启用重力" })
    public enableGravity: boolean = true;
    
    @property({ tooltip: "重力强度" })
    public gravity: number = -9.8;
    
    @property({ type: JoystickController, tooltip: "虚拟摇杆控制器" })
    public joystickController: JoystickController = null!;
    
    @property({ type: TreeManager, tooltip: "树木管理器" })
    public treeManager: TreeManager = null!;
    
    @property({ type: ChopAction, tooltip: "砍伐动作控制器" })
    public chopAction: ChopAction = null!;
    
    @property({ type: CameraController, tooltip: "摄像机控制器" })
    public cameraController: CameraController = null!;
    
    @property({ tooltip: "砍树检测半径" })
    public chopDetectionRadius: number = 2.0;
    
    // 旋转相关设置
    @property({ tooltip: "是否立即转向移动方向" })
    public instantRotation: boolean = false;
    
    @property({ tooltip: "最小输入阈值（避免微小输入导致旋转）" })
    public inputThreshold: number = 0.1;
    
    @property({ tooltip: "是否在停止移动时保持朝向" })
    public maintainDirectionWhenStopped: boolean = true;

    @property({ type: SkeletalAnimation, tooltip: "骨骼动画" })
    public skeletonAnimation: SkeletalAnimation = null!;

    private _currentAnimation: AnimationName = AnimationName.Idle;
    
    // 私有属性
    private _keyboardInput: Vec3 = new Vec3();
    private _joystickInput: Vec3 = new Vec3();
    private _finalInput: Vec3 = new Vec3();
    private _moveVector: Vec3 = new Vec3();
    private _tempVec3: Vec3 = new Vec3();
    private _isMoving: boolean = false;
    private _characterController: CharacterController | null = null;
    private _rigidBody: RigidBody | null = null;
    
    // 旋转相关
    private _currentDirection: Vec3 = new Vec3();
    private _targetDirection: Vec3 = new Vec3();
    private _lastMoveDirection: Vec3 = new Vec3();
    
    // 输入状态
    private _keys: { [key: string]: boolean } = {};

    @property({ type: WoodBackpack, tooltip: "木头背包组件" })
    public woodBackpack: WoodBackpack = null!;

    protected onLoad(): void {
        // 如果没有指定玩家节点，使用当前节点
        if (!this.playerNode) {
            this.playerNode = this.node;
        }
        
        // 获取物理组件
        this._characterController = this.playerNode.getComponent(CharacterController);
        this._rigidBody = this.playerNode.getComponent(RigidBody);
        
        // 启用输入事件
        this.enableInput();
        
        // 设置摇杆输入目标
        if (this.joystickController) {
            this.joystickController.setInputTarget(this);
        }
        
        // 设置摄像机跟随目标
        if (this.cameraController && this.playerNode) {
            this.cameraController.setTarget(this.playerNode);
        }
        
        // 确保有背包组件
        if (!this.woodBackpack) {
            this.woodBackpack = this.playerNode.getComponent(WoodBackpack) || 
                               this.playerNode.addComponent(WoodBackpack);
        }
        
        // 初始化方向
        this._lastMoveDirection.set(0, 0, 1); // 默认朝向前方

        
    }

    protected start(): void {
        //this.skeletonAnimation.on('play', this.onAnimationFinished, this);
        //
    }

    protected onDestroy(): void {
        this.disableInput();
    }

    /**
     * 启用输入监听
     */
    private enableInput(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    /**
     * 禁用输入监听
     */
    private disableInput(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    /**
     * 按键按下事件
     */
    private onKeyDown(event: EventKeyboard): void {
        this._keys[event.keyCode] = true;
    }

    /**
     * 按键抬起事件
     */
    private onKeyUp(event: EventKeyboard): void {
        this._keys[event.keyCode] = false;
    }

    /**
     * 获取键盘输入向量 - 添加调试版本
     */
    private getKeyboardInput(): Vec3 {
        this._keyboardInput.set(0, 0, 0);
        
        // WASD 或 方向键控制
        if (this._keys[KeyCode.KEY_W] || this._keys[KeyCode.ARROW_UP]) {
            this._keyboardInput.z -= 1;
        }
        if (this._keys[KeyCode.KEY_S] || this._keys[KeyCode.ARROW_DOWN]) {
            this._keyboardInput.z += 1;
        }
        if (this._keys[KeyCode.KEY_A] || this._keys[KeyCode.ARROW_LEFT]) {
            this._keyboardInput.x -= 1;
        }
        if (this._keys[KeyCode.KEY_D] || this._keys[KeyCode.ARROW_RIGHT]) {
            this._keyboardInput.x += 1;
        }
        
        // 标准化输入向量
        if (this._keyboardInput.length() > 0) {
            this._keyboardInput.normalize();
        }
        
        return this._keyboardInput;
    }

    /**
     * 实现IJoystickInput接口 - 接收摇杆输入（添加调试）
     */
    public setJoystickInput(direction: Vec3): void {
        this._joystickInput.set(direction);
        if(this.skeletonAnimation == null) return;

        var animationName = direction.x == 0 && direction.z == 0 ? AnimationName.Idle : AnimationName.Run;
        if(this._currentAnimation != animationName){
            this.skeletonAnimation.play(animationName);
            this._currentAnimation = animationName;
        }
    }

    /**
     * 合并所有输入源
     */
    private getFinalInput(): Vec3 {
        const keyboardInput = this.getKeyboardInput();
        
        // 合并键盘和摇杆输入（摇杆优先）
        if (this._joystickInput.length() > this.inputThreshold) {
            this._finalInput.set(this._joystickInput);
        } else {
            this._finalInput.set(keyboardInput);
        }
        
        // 确保向量标准化
        if (this._finalInput.length() > 1) {
            this._finalInput.normalize();
        }
        
        return this._finalInput;
    }

    /**
     * 更新移动逻辑
     */
    protected update(deltaTime: number): void {
        this.handleMovement(deltaTime);
        this.handleRotation(deltaTime);

        ArrowTipController.inst?.updateArrowTip(this.playerNode);
        //this.handleTreeInteraction();
    }

    /**
     * 处理移动
     */
    private handleMovement(deltaTime: number): void {
        const inputVector = this.getFinalInput();
        this._isMoving = inputVector.length() > this.inputThreshold;
        
        if (this._isMoving) {
            // 保存当前移动方向用于旋转
            this._lastMoveDirection.set(inputVector);
            
            // 计算移动向量
            Vec3.multiplyScalar(this._moveVector, inputVector, this.moveSpeed * deltaTime);
            
            // 如果使用CharacterController
            if (this._characterController) {
                // 添加重力
                if (this.enableGravity) {
                    this._moveVector.y += this.gravity * deltaTime;
                }
                this._characterController.move(this._moveVector);
            }
            // 如果使用RigidBody
            else if (this._rigidBody) {
                this._rigidBody.getLinearVelocity(this._tempVec3);
                this._tempVec3.x = this._moveVector.x / deltaTime;
                this._tempVec3.z = this._moveVector.z / deltaTime;
                this._rigidBody.setLinearVelocity(this._tempVec3);
            }
            // 直接移动Transform
            else {
                this.playerNode.getPosition(this._tempVec3);
                Vec3.add(this._tempVec3, this._tempVec3, this._moveVector);
                this.playerNode.setPosition(this._tempVec3);
            }
        } else {
            // 停止移动时的处理
            if (this._rigidBody) {
                this._rigidBody.getLinearVelocity(this._tempVec3);
                this._tempVec3.x = 0;
                this._tempVec3.z = 0;
                this._rigidBody.setLinearVelocity(this._tempVec3);
            }
        }
    }

    /**
     * 处理旋转 - 完全修正版本，包含详细调试
     */
    private handleRotation(deltaTime: number): void {
        let targetDirection: Vec3;
        
        if (this._isMoving) {
            // 移动时，面向移动方向
            targetDirection = this.getFinalInput();
        } else if (this.maintainDirectionWhenStopped) {
            // 停止移动时，保持最后的移动方向
            targetDirection = this._lastMoveDirection;
        } else {
            // 不保持方向，直接返回
            return;
        }
        
        // 检查目标方向是否有效
        if (targetDirection.length() < this.inputThreshold) {
            return;
        }
        
        let targetAngle = -Math.atan2(targetDirection.x, -targetDirection.z) * 180 / Math.PI;
        
        // 获取当前角度
        const currentEuler = this.playerNode.eulerAngles;
        let currentAngle = currentEuler.y;
        
        if (this.instantRotation) {
            // 立即旋转到目标方向
            currentEuler.y = targetAngle;
            this.playerNode.setRotationFromEuler(currentEuler);
        } else {
            // 平滑旋转到目标方向
            const angleDiff = this.getAngleDifference(currentAngle, targetAngle);
            
            // 计算旋转步长
            const maxRotationStep = this.rotationSpeed * deltaTime;
            const rotationStep = math.clamp(angleDiff, -maxRotationStep, maxRotationStep);
            
            // 应用旋转
            const newAngle = this.normalizeAngle(currentAngle + rotationStep);
            currentEuler.y = newAngle;
            this.playerNode.setRotationFromEuler(currentEuler);
        }
    }

    /**
     * 处理树木交互
     */
    private handleTreeInteraction(): void {
        if (!this.treeManager) {
            return;
        }
        
        // 检测附近的树木
        const nearbyTrees = this.treeManager.getNearbyTrees(
            this.playerNode.position, 
            this.chopDetectionRadius
        );
        
        if (nearbyTrees.length > 0 && this.chopAction && !this.chopAction.isPlaying()) {
            // 找到最近的树木
            const closestTree = nearbyTrees[0];
            
            // 面向最近的树木
            if (!this._isMoving) {
                this.faceTarget(closestTree.node.position);
            }
            console.log('playChopSound3');
            // 播放砍伐动作
            this.chopAction.playChopAction(closestTree.node.position);
            
            // 触发摄像机震动效果
            if (this.cameraController) {
                this.cameraController.startShake(0.2, 0.5);
            }
        }
    }

    /**
     * 面向指定目标位置 - 公开方法
     */
    public faceTarget(targetPosition: Vec3): void {
        // 计算从玩家到目标的方向
        Vec3.subtract(this._tempVec3, targetPosition.clone().add(new Vec3(-3.363214, 0, -1.260171)), this.playerNode.position);
        this._tempVec3.y = 0; // 忽略Y轴差异
        
        if (this._tempVec3.length() > 0.1) {
            Vec3.normalize(this._tempVec3, this._tempVec3);
            
            // 修正：计算目标角度，使用相同的计算方法
            const targetAngle = -Math.atan2(this._tempVec3.x, -this._tempVec3.z) * 180 / Math.PI;
            
            // 立即转向目标
            var currentEuler = this.playerNode.eulerAngles.clone();
            currentEuler.y = targetAngle;
            this.playerNode.setRotationFromEuler(currentEuler);
            
            // 更新最后移动方向
            this._lastMoveDirection.set(this._tempVec3);
        }
    }

    /**
     * 计算角度差值（考虑360度环绕）
     */
    private getAngleDifference(current: number, target: number): number {
        let diff = target - current;
        
        // 处理角度环绕，选择最短路径
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        
        return diff;
    }

    /**
     * 标准化角度到0-360度范围
     */
    private normalizeAngle(angle: number): number {
        while (angle < 0) angle += 360;
        while (angle >= 360) angle -= 360;
        return angle;
    }

    /**
     * 测试不同的角度计算方法（临时调试用）
     */
    private testRotationMethods(inputX: number, inputZ: number): void {
        console.log(`=== 测试输入 x=${inputX}, z=${inputZ} ===`);
        
        const method1 = Math.atan2(inputX, -inputZ) * 180 / Math.PI;
        const method2 = Math.atan2(inputX, inputZ) * 180 / Math.PI;
        const method3 = Math.atan2(-inputX, -inputZ) * 180 / Math.PI;
        const method4 = (Math.atan2(inputX, -inputZ) * 180 / Math.PI + 180) % 360;
        
        console.log(`方法1: ${method1.toFixed(1)}度`);
        console.log(`方法2: ${method2.toFixed(1)}度`);
        console.log(`方法3: ${method3.toFixed(1)}度`);
        console.log(`方法4: ${method4.toFixed(1)}度`);
    }

    /**
     * 获取玩家是否在移动
     */
    public isMoving(): boolean {
        return this._isMoving;
    }

    /**
     * 获取当前移动方向
     */
    public getCurrentMoveDirection(): Vec3 {
        return this._lastMoveDirection.clone();
    }

    /**
     * 获取当前朝向角度
     */
    public getCurrentFacingAngle(): number {
        return this.playerNode.eulerAngles.y;
    }

    /**
     * 设置玩家朝向（角度）- 修正版本
     */
    public setFacingAngle(angle: number): void {
        console.log("setFacingAngle", angle);
        const currentEuler = this.playerNode.eulerAngles;
        currentEuler.y = this.normalizeAngle(angle);
        this.playerNode.setRotationFromEuler(currentEuler);
        
        // 修正：更新方向向量，考虑前方是-Z方向
        const radians = angle * Math.PI / 180;
        this._lastMoveDirection.set(Math.sin(radians), 0, -Math.cos(radians));
    }

    /**
     * 停止移动
     */
    public stopMovement(): void {
        this._keys = {};
        this._joystickInput.set(0, 0, 0);
        this._isMoving = false;
        
        if (this._rigidBody) {
            this._rigidBody.getLinearVelocity(this._tempVec3);
            this._tempVec3.x = 0;
            this._tempVec3.z = 0;
            this._rigidBody.setLinearVelocity(this._tempVec3);
        }

        this.skeletonAnimation.play(AnimationName.Idle);
        this._currentAnimation = AnimationName.Idle;
    }

    /**
     * 传送玩家到指定位置
     */
    public teleportTo(position: Vec3): void {
        this.playerNode.setPosition(position);
        
        if (this._rigidBody) {
            this._rigidBody.setLinearVelocity(Vec3.ZERO);
            this._rigidBody.setAngularVelocity(Vec3.ZERO);
        }
    }

    /**
     * 启用/禁用玩家控制
     */
    public setControlEnabled(enabled: boolean): void {
        if (enabled) {
            this.enableInput();
        } else {
            this.disableInput();
            this.stopMovement();
        }
    }

    public playAnimation(animationName: AnimationName): void {
        this.skeletonAnimation.play(animationName);
        this._currentAnimation = animationName;
    }
    // private onAnimationFinished(type: AnimationStateEventType, state: AnimationState): void {
    //     console.log("onAnimationFinished", type);        
    // }

}
