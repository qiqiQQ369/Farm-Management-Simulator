import { _decorator, Component, Node, Vec2, Vec3, UITransform, Input, input, EventTouch, Graphics, Color } from 'cc';
const { ccclass, property } = _decorator;

export interface IJoystickInput {
    /**
     * 设置摇杆输入向量
     * @param direction 标准化的方向向量
     */
    setJoystickInput(direction: Vec3): void;
}

/**
 * 虚拟摇杆控制器
 * 提供触摸屏设备的移动控制
 */
@ccclass('JoystickController')
export class JoystickController extends Component {
    
    @property({ type: Node, tooltip: "摇杆背景节点" })
    public joystickBg: Node = null!;
    
    @property({ type: Node, tooltip: "摇杆把手节点" })
    public joystickHandle: Node = null!;
    
    @property({ tooltip: "摇杆半径" })
    public joystickRadius: number = 80;
    
    @property({ tooltip: "把手半径" })
    public handleRadius: number = 30;
    
    @property({ tooltip: "是否在屏幕任意位置创建摇杆" })
    public createOnTouch: boolean = true;
    
    @property({ tooltip: "摇杆透明度" })
    public joystickAlpha: number = 0.8;
    
    @property({ tooltip: "把手回弹速度" })
    public returnSpeed: number = 10;
    
    @property({ tooltip: "死区半径(0-1)" })
    public deadZone: number = 0.1;
    
    // 私有属性
    private _inputTarget: IJoystickInput | null = null;
    private _isDragging: boolean = false;
    private _joystickCenter: Vec2 = new Vec2();
    private _currentDirection: Vec2 = new Vec2();
    private _outputDirection: Vec3 = new Vec3();
    private _uiTransform: UITransform = null!;
    private _bgUITransform: UITransform = null!;
    private _handleUITransform: UITransform = null!;
    private _isVisible: boolean = false;
    private _canvasNode: Node = null!; // 用于全局事件监听

    public _lock:boolean = false;

    protected onLoad(): void {
        this.initializeComponents();
        this.setupEventListeners();
        this.hideJoystick();
    }

    protected onDestroy(): void {
        this.removeEventListeners();
    }

    /**
     * 初始化组件
     */
    private initializeComponents(): void {
        this._uiTransform = this.getComponent(UITransform)!;
        
        // 找到Canvas节点用于全局事件监听
        this._canvasNode = this.findCanvasNode();
        
        if (!this.joystickBg || !this.joystickHandle) {
            this.createJoystickUI();
        }
        
        this._bgUITransform = this.joystickBg.getComponent(UITransform)!;
        this._handleUITransform = this.joystickHandle.getComponent(UITransform)!;
        
        // 设置初始透明度
        this.setJoystickAlpha(this.joystickAlpha);
    }

    /**
     * 查找Canvas节点
     */
    private findCanvasNode(): Node {
        let current = this.node;
        while (current.parent) {
            current = current.parent;
            if (current.name === 'Canvas' || current.getComponent('cc.Canvas')) {
                return current;
            }
        }
        return current; // 返回根节点
    }

    /**
     * 创建摇杆UI（如果不存在）
     */
    private createJoystickUI(): void {
        // 创建背景
        if (!this.joystickBg) {
            this.joystickBg = new Node('JoystickBg');
            this.joystickBg.setParent(this.node);
            this.joystickBg.addComponent(UITransform);
            
            // 添加图形组件绘制圆形背景
            const bgGraphics = this.joystickBg.addComponent(Graphics);
            bgGraphics.circle(0, 0, this.joystickRadius);
            bgGraphics.fillColor = new Color(255, 255, 255, 100);
            bgGraphics.fill();
            bgGraphics.strokeColor = new Color(255, 255, 255, 150);
            bgGraphics.lineWidth = 3;
            bgGraphics.stroke();
        }
        
        // 创建把手
        if (!this.joystickHandle) {
            this.joystickHandle = new Node('JoystickHandle');
            this.joystickHandle.setParent(this.joystickBg);
            this.joystickHandle.addComponent(UITransform);
            
            // 添加图形组件绘制把手
            const handleGraphics = this.joystickHandle.addComponent(Graphics);
            handleGraphics.circle(0, 0, this.handleRadius);
            handleGraphics.fillColor = new Color(255, 255, 255, 200);
            handleGraphics.fill();
            handleGraphics.strokeColor = new Color(100, 100, 100, 255);
            handleGraphics.lineWidth = 2;
            handleGraphics.stroke();
        }
    }

    /**
     * 设置摇杆透明度
     */
    private setJoystickAlpha(alpha: number): void {
        // 设置Graphics组件的透明度
        if (this.joystickBg) {
            const bgGraphics = this.joystickBg.getComponent(Graphics);
            if (bgGraphics) {
                const bgColor = bgGraphics.fillColor.clone();
                bgColor.a = alpha * 100;
                bgGraphics.fillColor = bgColor;
                
                const strokeColor = bgGraphics.strokeColor.clone();
                strokeColor.a = alpha * 150;
                bgGraphics.strokeColor = strokeColor;
            }
        }
        
        if (this.joystickHandle) {
            const handleGraphics = this.joystickHandle.getComponent(Graphics);
            if (handleGraphics) {
                const handleColor = handleGraphics.fillColor.clone();
                handleColor.a = alpha * 200;
                handleGraphics.fillColor = handleColor;
            }
        }
    }

    /**
     * 设置事件监听 - 修复：在Canvas节点上监听，避免节点禁用导致事件失效
     */
    private setupEventListeners(): void {
        if (this._canvasNode) {
            this._canvasNode.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
            this._canvasNode.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this._canvasNode.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
            this._canvasNode.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        }
    }

    /**
     * 移除事件监听
     */
    private removeEventListeners(): void {
        if (this._canvasNode) {
            this._canvasNode.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
            this._canvasNode.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this._canvasNode.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
            this._canvasNode.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        }
    }

    /**
     * 触摸开始
     */
    private onTouchStart(event: EventTouch): void {
        if(this._lock) return;

        const touchPos = event.getUILocation();
        
        // 如果摇杆不可见且启用了动态创建
        if (this.createOnTouch && !this._isVisible) {
            this.showJoystickAt(touchPos);
            this._isDragging = true;
            this.updateJoystick(touchPos);
        }
        // 如果摇杆可见，检查触摸是否在摇杆范围内
        else if (this._isVisible && this.isTouchInJoystick(touchPos)) {
            this._isDragging = true;
            this.updateJoystick(touchPos);
        }
    }

    /**
     * 触摸移动
     */
    private onTouchMove(event: EventTouch): void {
        if(this._lock) return;

        if (this._isDragging) {
            this.updateJoystick(event.getUILocation());
        }
    }

    /**
     * 触摸结束
     */
    private onTouchEnd(event: EventTouch): void {
        if (this._isDragging) {
            this._isDragging = false;
            this.resetJoystick();
            
            if (this.createOnTouch) {
                this.hideJoystick();
            }
        }
    }

    /**
     * 检查触摸点是否在摇杆范围内
     */
    private isTouchInJoystick(touchPos: Vec2): boolean {
        if (!this._isVisible || !this.joystickBg) {
            return false;
        }
        
        // 转换触摸位置到摇杆背景的本地坐标
        const localPos = new Vec3();
        this._bgUITransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0), localPos);
        
        // 检查是否在摇杆半径范围内
        return localPos.length() <= this.joystickRadius;
    }

    /**
     * 更新摇杆状态
     */
    private updateJoystick(touchPos: Vec2): void {
        if (!this._isVisible || !this.joystickBg) {
            return;
        }
        
        // 转换触摸位置到摇杆本地坐标
        const localPos = new Vec3();
        this._bgUITransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0), localPos);
        
        // 计算距离和方向
        const distance = Math.sqrt(localPos.x * localPos.x + localPos.y * localPos.y);
        const normalizedDistance = Math.min(distance / this.joystickRadius, 1.0);
        
        if (normalizedDistance > this.deadZone) {
            // 计算方向向量
            this._currentDirection.set(localPos.x, localPos.y).normalize();
            
            // 限制把手位置在摇杆范围内
            const clampedDistance = Math.min(distance, this.joystickRadius);
            const handlePos = Vec2.multiplyScalar(new Vec2(), this._currentDirection, clampedDistance);
            this.joystickHandle.setPosition(handlePos.x, handlePos.y, 0);
            
            // 计算输出方向，添加45度摄像机偏移补偿
            const intensity = (normalizedDistance - this.deadZone) / (1.0 - this.deadZone);
            
            // 原始方向
            const rawX = this._currentDirection.x * intensity;
            const rawZ = -this._currentDirection.y * intensity;
            
            // 应用45度旋转补偿摄像机偏移
            const cos45 = 1;//Math.cos(Math.PI / 4); // cos(45°) = √2/2
            const sin45 = 1;//Math.sin(Math.PI / 4); // sin(45°) = √2/2
            
            // const rotatedX = rawX * cos45 - rawZ * sin45;
            // const rotatedZ = rawX * sin45 + rawZ * cos45;
            
            this._outputDirection.set(rawX, 0, rawZ);
        } else {
            // 在死区内，无输出
            this._outputDirection.set(0, 0, 0);
            this.joystickHandle.setPosition(0, 0, 0);
        }
        
        // 发送输入到目标
        if (this._inputTarget) {
            this._inputTarget.setJoystickInput(this._outputDirection.normalize());
        }
    }

    /**
     * 重置摇杆
     */
    private resetJoystick(): void {
        this._currentDirection.set(0, 0);
        this._outputDirection.set(0, 0, 0);
        
        // 平滑回到中心
        if (this.joystickHandle) {
            this.joystickHandle.setPosition(0, 0, 0);
        }
        
        // 发送停止信号
        if (this._inputTarget) {
            this._inputTarget.setJoystickInput(Vec3.ZERO);
        }
    }

    /**
     * 在指定位置显示摇杆
     */
    private showJoystickAt(position: Vec2): void {
        this._joystickCenter.set(position);
        
        // 转换屏幕坐标到父节点的本地坐标
        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (parentTransform) {
            const localPos = new Vec3();
            parentTransform.convertToNodeSpaceAR(new Vec3(position.x, position.y, 0), localPos);
            this.node.setPosition(localPos);
        } else {
            this.node.setPosition(position.x, position.y, 0);
        }
        
        this.showJoystick();
    }

    /**
     * 显示摇杆
     */
    private showJoystick(): void {
        this._isVisible = true;
        this.node.active = true;
        // 重新设置透明度
        this.setJoystickAlpha(this.joystickAlpha);
    }

    /**
     * 隐藏摇杆
     */
    private hideJoystick(): void {
        this._isVisible = false;
        if (this.createOnTouch) {
            this.node.active = false;
        }
        this.resetJoystick();
    }

    /**
     * 设置输入目标
     */
    public setInputTarget(target: IJoystickInput): void {
        this._inputTarget = target;
    }

    /**
     * 获取当前方向
     */
    public getCurrentDirection(): Vec3 {
        return this._outputDirection.clone();
    }

    /**
     * 是否正在拖拽
     */
    public isDragging(): boolean {
        return this._isDragging;
    }

    /**
     * 设置摇杆半径
     */
    public setJoystickRadius(radius: number): void {
        this.joystickRadius = radius;
    }

    /**
     * 设置死区
     */
    public setDeadZone(deadZone: number): void {
        this.deadZone = Math.max(0, Math.min(1, deadZone));
    }

    /**
     * 手动显示摇杆（用于固定位置摇杆）
     */
    public showAtPosition(position: Vec2): void {
        this.createOnTouch = false;
        this.showJoystickAt(position);
    }

    /**
     * 手动隐藏摇杆
     */
    public hide(): void {
        this.hideJoystick();
    }

    protected update(deltaTime: number): void {
        if (this._isDragging && this._inputTarget) {
            this._inputTarget.setJoystickInput(this._outputDirection.clone());
        }
        // 平滑回弹动画
        if (!this._isDragging && this.joystickHandle && this.returnSpeed > 0 && this._isVisible) {
            const currentPos = this.joystickHandle.position;
            if (currentPos.length() > 0.1) {
                const newPos = Vec3.lerp(new Vec3(), currentPos, Vec3.ZERO, deltaTime * this.returnSpeed);
                this.joystickHandle.setPosition(newPos);
            }
        }
    }
}
