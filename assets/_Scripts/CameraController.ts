import { _decorator, Component, Node, Vec3, Camera, lerp, math } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 摄像机跟随模式枚举
 */
export enum CameraFollowMode {
    Fixed = 0,        // 固定跟随
    Smooth = 1,       // 平滑跟随
    Prediction = 2    // 预测跟随
}

/**
 * 摄像机跟随控制器
 * 实现摄像机跟随玩家移动的功能
 */
@ccclass('CameraController')
export class CameraController extends Component {
    
    @property({ type: Node, tooltip: "目标节点（玩家）" })
    public target: Node = null!;
    
    @property({ type: Camera, tooltip: "摄像机组件" })
    public camera: Camera = null!;
    
    @property({ tooltip: "跟随模式" })
    public followMode: CameraFollowMode = CameraFollowMode.Smooth;
    
    @property({ tooltip: "跟随速度 (0-1)" })
    public followSpeed: number = 0.1;
    
    @property({ tooltip: "摄像机距离目标的偏移" })
    public offset: Vec3 = new Vec3(0, 10, 8);

    @property({ tooltip: "相机到玩家的跟随距离" })
    public followDistance: number = 17;
    
    @property({ tooltip: "摄像机注视点偏移" })
    public lookAtOffset: Vec3 = new Vec3(0, 0, 0);
    
    @property({ tooltip: "是否启用平滑旋转" })
    public enableSmoothRotation: boolean = true;
    
    @property({ tooltip: "旋转速度" })
    public rotationSpeed: number = 0.05;
    
    @property({ tooltip: "预测系数（预测跟随模式）" })
    public predictionFactor: number = 2.0;
    
    @property({ tooltip: "死区半径" })
    public deadZone: number = 1.0;
    
    @property({ tooltip: "最大跟随距离" })
    public maxFollowDistance: number = 20.0;
    
    // 边界限制
    @property({ tooltip: "是否启用边界限制" })
    public enableBounds: boolean = true;
    
    @property({ tooltip: "边界最小值" })
    public boundsMin: Vec3 = new Vec3(-50, 5, -50);
    
    @property({ tooltip: "边界最大值" })
    public boundsMax: Vec3 = new Vec3(50, 30, 50);
    
    // 震动设置
    @property({ tooltip: "是否启用摄像机震动" })
    public enableShake: boolean = false;
    
    @property({ tooltip: "震动强度" })
    public shakeIntensity: number = 1.0;
    
    @property({ tooltip: "震动衰减速度" })
    public shakeDecay: number = 5.0;
    
    // 私有属性
    private _targetPosition: Vec3 = new Vec3();
    private _currentVelocity: Vec3 = new Vec3();
    private _previousTargetPosition: Vec3 = new Vec3();
    private _isInitialized: boolean = false;
    private _originalOffset: Vec3 = new Vec3();
    
    // 震动相关
    private _shakeTimer: number = 0;
    private _shakeOffset: Vec3 = new Vec3();
    
    // 临时变量
    private _tempVec3: Vec3 = new Vec3();
    private _tempVec3_2: Vec3 = new Vec3();

    protected onLoad(): void {
        this.initializeCamera();
    }

    protected start(): void {
        if (this.target) {
            this.initializePosition();
        }
    }

    protected update(deltaTime: number): void {
        if (!this.target || !this.camera) return;

        // 更新震动效果
        this.updateShake(deltaTime);
        
        // 根据跟随模式更新摄像机位置
        switch (this.followMode) {
            case CameraFollowMode.Fixed:
                this.updateFixedFollow();
                break;
            case CameraFollowMode.Smooth:
                this.updateSmoothFollow(deltaTime);
                break;
            case CameraFollowMode.Prediction:
                this.updatePredictionFollow(deltaTime);
                break;
        }
        
        // 应用边界限制
        if (this.enableBounds) {
            this.applyBounds();
        }
        
        // 更新前一帧的目标位置
        this._previousTargetPosition.set(this.target.worldPosition);
    }

    /**
     * 初始化摄像机
     */
    private initializeCamera(): void {
        if (!this.camera) {
            this.camera = this.getComponent(Camera) || this.node.getComponent(Camera);
        }
        
        if (!this.camera) {
            console.error('CameraController: 未找到Camera组件');
            return;
        }
        
        // 保存原始偏移量
        this._originalOffset.set(this.offset);
    }

    /**
     * 初始化位置
     */
    private initializePosition(): void {
        if (!this.target || this._isInitialized) return;
        
        // 根据当前相机朝向设置初始位置，保持目标位于画面中心。
        this.calculateFollowPosition(this._targetPosition, this.target.worldPosition);
        this.node.setWorldPosition(this._targetPosition);
        
        // 初始化前一帧位置
        this._previousTargetPosition.set(this.target.worldPosition);
        
        this._isInitialized = true;
        console.log('摄像机初始化完成');
    }

    /**
     * 固定跟随更新
     */
    private updateFixedFollow(): void {
        this.calculateFollowPosition(this._targetPosition, this.target.worldPosition);
        this.node.setWorldPosition(this._targetPosition);
    }

    /**
     * 平滑跟随更新
     */
    private updateSmoothFollow(deltaTime: number): void {
        // 根据当前相机朝向计算目标位置，旋转由编辑器控制且不会被运行时改写。
        this.calculateFollowPosition(this._targetPosition, this.target.worldPosition);
        
        // 检查是否在死区内
        const currentPos = this.node.worldPosition;
        const distance = Vec3.distance(currentPos, this._targetPosition);
        
        if (distance > this.deadZone) {
            // 平滑移动到目标位置
            Vec3.lerp(this._tempVec3, currentPos, this._targetPosition, 
                     Math.min(this.followSpeed * deltaTime * 60, 1.0));
            this.node.setWorldPosition(this._tempVec3);
        }
    }

    /**
     * 预测跟随更新
     */
    private updatePredictionFollow(deltaTime: number): void {
        // 计算目标速度
        Vec3.subtract(this._currentVelocity, this.target.worldPosition, this._previousTargetPosition);
        Vec3.multiplyScalar(this._currentVelocity, this._currentVelocity, 1.0 / deltaTime);
        
        // 预测目标未来位置
        Vec3.multiplyScalar(this._tempVec3, this._currentVelocity, this.predictionFactor * deltaTime);
        Vec3.add(this._tempVec3_2, this.target.worldPosition, this._tempVec3);
        this.calculateFollowPosition(this._targetPosition, this._tempVec3_2);
        
        // 限制最大跟随距离
        const currentPos = this.node.worldPosition;
        const distance = Vec3.distance(currentPos, this._targetPosition);
        if (distance > this.maxFollowDistance) {
            Vec3.subtract(this._tempVec3, this._targetPosition, currentPos);
            Vec3.normalize(this._tempVec3, this._tempVec3);
            Vec3.multiplyScalar(this._tempVec3, this._tempVec3, this.maxFollowDistance);
            Vec3.add(this._targetPosition, currentPos, this._tempVec3);
        }
        
        // 平滑移动
        Vec3.lerp(this._tempVec3, currentPos, this._targetPosition,
                 Math.min(this.followSpeed * deltaTime * 60, 1.0));
        this.node.setWorldPosition(this._tempVec3);
    }

    /**
     * 应用边界限制
     */
    private applyBounds(): void {
        const currentPos = this.node.worldPosition;
        
        this._tempVec3.set(
            math.clamp(currentPos.x, this.boundsMin.x, this.boundsMax.x),
            // 锁定高度会破坏“目标位于画面中心”的相机射线，因此不限制 Y 轴。
            currentPos.y,
            math.clamp(currentPos.z, this.boundsMin.z, this.boundsMax.z)
        );
        
        this.node.setWorldPosition(this._tempVec3);
    }

    /**
     * 按相机当前朝向计算跟随位置。
     * 只读取朝向，不会在运行时修改相机 Rotation。
     */
    private calculateFollowPosition(out: Vec3, targetPosition: Vec3): void {
        Vec3.multiplyScalar(this._tempVec3, this.node.forward, -this.followDistance);
        Vec3.add(out, targetPosition, this._tempVec3);
    }

    /**
     * 更新摄像机注视
     */
    private updateLookAt(): void {
        if (!this.enableSmoothRotation) return;
        
        // 计算注视目标
        Vec3.add(this._tempVec3, this.target.position, this.lookAtOffset);
        
        // 添加震动偏移
        if (this.enableShake && this._shakeTimer > 0) {
            Vec3.add(this._tempVec3, this._tempVec3, this._shakeOffset);
        }
        
        // 计算从摄像机到目标的方向
        Vec3.subtract(this._tempVec3_2, this._tempVec3, this.node.position);
        
        if (this._tempVec3_2.length() > 0.001) {
            Vec3.normalize(this._tempVec3_2, this._tempVec3_2);
            
            // 计算目标旋转
            const targetRotation = math.quat();
            math.Quat.fromViewUp(targetRotation, this._tempVec3_2, Vec3.UP);
            
            // 平滑旋转
            const currentRotation = this.node.rotation;
            math.Quat.slerp(currentRotation, currentRotation, targetRotation, this.rotationSpeed);
            this.node.setRotation(currentRotation);
        }
    }

    /**
     * 更新震动效果
     */
    private updateShake(deltaTime: number): void {
        if (!this.enableShake || this._shakeTimer <= 0) {
            this._shakeOffset.set(0, 0, 0);
            return;
        }
        
        // 减少震动时间
        this._shakeTimer -= deltaTime;
        
        // 计算震动强度（随时间衰减）
        const intensity = this._shakeTimer * this.shakeIntensity;
        
        // 生成随机震动偏移
        this._shakeOffset.set(
            (Math.random() - 0.5) * intensity,
            (Math.random() - 0.5) * intensity,
            (Math.random() - 0.5) * intensity
        );
        
        // 将震动应用到摄像机位置
        Vec3.add(this._tempVec3, this.node.position, this._shakeOffset);
        this.node.setPosition(this._tempVec3);
    }

    /**
     * 设置跟随目标
     */
    public setTarget(target: Node): void {
        this.target = target;
        this._isInitialized = false;
        
        if (this.target) {
            this.initializePosition();
        }
    }

    /**
     * 设置摄像机偏移
     */
    public setOffset(offset: Vec3): void {
        this.offset.set(offset);
        this.followDistance = offset.length();
    }

    /**
     * 设置跟随模式
     */
    public setFollowMode(mode: CameraFollowMode): void {
        this.followMode = mode;
        console.log(`摄像机跟随模式切换为: ${CameraFollowMode[mode]}`);
    }

    /**
     * 设置跟随速度
     */
    public setFollowSpeed(speed: number): void {
        this.followSpeed = math.clamp(speed, 0.01, 1.0);
    }

    /**
     * 开始震动效果
     */
    public startShake(duration: number, intensity?: number): void {
        this._shakeTimer = duration;
        if (intensity !== undefined) {
            this.shakeIntensity = intensity;
        }
        console.log(`摄像机震动开始: 持续时间=${duration}秒, 强度=${this.shakeIntensity}`);
    }

    /**
     * 停止震动效果
     */
    public stopShake(): void {
        this._shakeTimer = 0;
        this._shakeOffset.set(0, 0, 0);
    }

    /**
     * 立即移动到目标位置
     */
    public snapToTarget(): void {
        if (!this.target) return;
        
        this.calculateFollowPosition(this._targetPosition, this.target.worldPosition);
        this.node.setWorldPosition(this._targetPosition);
        this._previousTargetPosition.set(this.target.worldPosition);
    }

    /**
     * 重置摄像机
     */
    public reset(): void {
        this.offset.set(this._originalOffset);
        this.followDistance = this._originalOffset.length();
        this.followMode = CameraFollowMode.Smooth;
        this.followSpeed = 0.1;
        this.stopShake();
        
        if (this.target) {
            this.snapToTarget();
        }
    }

    /**
     * 获取摄像机状态信息
     */
    public getCameraInfo(): { 
        mode: string, 
        position: Vec3, 
        targetDistance: number, 
        isShaking: boolean 
    } {
        return {
            mode: CameraFollowMode[this.followMode],
            position: this.node.worldPosition.clone(),
            targetDistance: this.target ? Vec3.distance(this.node.worldPosition, this.target.worldPosition) : 0,
            isShaking: this._shakeTimer > 0
        };
    }
}
