import { _decorator, Component, Node, Vec3, Prefab, instantiate, tween, find } from 'cc';
import { VehicleCollector } from './VehicleCollector';
const { ccclass, property } = _decorator;

/**
 * 车辆管理器状态枚举
 */
enum VehicleManagerState {
    IDLE = 0,           // 空闲状态
    VEHICLE_WORKING = 1, // 有车辆在工作
    DISPATCHING = 2     // 正在调度新车辆
}

/**
 * 车辆信息接口
 */
interface VehicleInfo {
    node: Node;
    collector: VehicleCollector;
    id: number;
    isActive: boolean;
}

/**
 * 车辆管理器组件
 * 管理车辆队列，实现自动调度和循环作业
 */
@ccclass('VehicleManager')
export class VehicleManager extends Component {
    
    @property({ type: Prefab, tooltip: "车辆预制件" })
    public vehiclePrefab: Prefab = null!;
    
    @property({ type: Node, tooltip: "等待区位置" })
    public waitingArea: Node = null!;
    
    @property({ type: Node, tooltip: "装货区位置" })
    public loadingArea: Node = null!;
    
    @property({ type: Node, tooltip: "转弯中间点" })
    public turnPoint: Node = null!;
    
    @property({ type: Node, tooltip: "投放区位置" })
    public dropOffArea: Node = null!;
    
    @property({ type: Node, tooltip: "目标收集区域" })
    public targetCollectionArea: Node = null!;
    
    @property({ type: Node, tooltip: "金币投放区域" })
    public coinDropArea: Node = null!;
    
    @property({ type: Prefab, tooltip: "金币预制件" })
    public coinPrefab: Prefab = null!;
    
    // 车辆队列设置
    @property({ group: { name: "车辆队列设置", id: "1" }, tooltip: "最大车辆数量" })
    public maxVehicles: number = 3;
    
    @property({ group: { name: "车辆队列设置", id: "1" }, tooltip: "等待区车辆间距" })
    public waitingSpacing: number = 3.0;
    
    // 移动设置
    @property({ group: { name: "移动设置", id: "2" }, tooltip: "车辆移动速度" })
    public vehicleMoveSpeed: number = 3.0;
    
    @property({ group: { name: "移动设置", id: "2" }, tooltip: "转弯速度" })
    public turnSpeed: number = 2.0;
    
    @property({ group: { name: "移动设置", id: "2" }, tooltip: "投放后等待时间" })
    public dropWaitTime: number = 2.0;
    
    // 私有属性
    private _vehicles: VehicleInfo[] = [];
    private _managerState: VehicleManagerState = VehicleManagerState.IDLE;
    private _activeVehicle: VehicleInfo | null = null;
    private _vehicleIdCounter: number = 0;
    private _isInitialized: boolean = false;

    protected onLoad(): void {
        this.validateComponents();
    }

    protected start(): void {
        this.initializeVehicleQueue();
    }

    /**
     * 验证必要组件
     */
    private validateComponents(): void {
        const requiredComponents = [
            { component: this.vehiclePrefab, name: "车辆预制件" },
            { component: this.waitingArea, name: "等待区位置" },
            { component: this.loadingArea, name: "装货区位置" },
            { component: this.turnPoint, name: "转弯中间点" },
            { component: this.dropOffArea, name: "投放区位置" },
            { component: this.targetCollectionArea, name: "目标收集区域" },
            { component: this.coinDropArea, name: "金币投放区域" },
            { component: this.coinPrefab, name: "金币预制件" }
        ];

        for (const item of requiredComponents) {
            if (!item.component) {
                console.error(`VehicleManager: ${item.name}未设置`);
            }
        }
    }

    /**
     * 初始化车辆队列
     */
    private initializeVehicleQueue(): void {
        console.log('初始化车辆队列...');
        
        // 创建初始车辆队列
        for (let i = 0; i < this.maxVehicles; i++) {
            this.createVehicleInWaitingArea();
        }
        
        this._isInitialized = true;
        
        // 启动第一辆车
        this.scheduleOnce(() => {
            this.dispatchNextVehicle();
        }, 1.0);
    }

    /**
     * 在等待区创建车辆
     */
    private createVehicleInWaitingArea(): void {
        if (!this.vehiclePrefab || !this.waitingArea) {
            console.error('无法创建车辆：预制件或等待区未设置');
            return;
        }

        const vehicleNode = instantiate(this.vehiclePrefab);
        const vehicleCollector = vehicleNode.getComponent(VehicleCollector);
        
        if (!vehicleCollector) {
            console.error('车辆预制件上没有找到 VehicleCollector 组件');
            vehicleNode.destroy();
            return;
        }

        // 配置车辆收集器
        this.configureVehicleCollector(vehicleCollector);


        // 计算等待区位置
       // const waitingPosition = this.calculateWaitingPosition(this._vehicles.length);
        vehicleNode.setParent(this.node);
        vehicleNode.setPosition(new Vec3(-2.476, 0, 14));
        vehicleNode.setRotationFromEuler(0, 90, 0); // 设置初始Y轴90度旋转

        // 创建车辆信息
        const vehicleInfo: VehicleInfo = {
            node: vehicleNode,
            collector: vehicleCollector,
            id: this._vehicleIdCounter++,
            isActive: false
        };

        this._vehicles.push(vehicleInfo);
        
        console.log(`创建车辆 #${vehicleInfo.id}，等待区位置: ${this._vehicles.length}`);
    }

    /**
     * 配置车辆收集器
     */
    private configureVehicleCollector(collector: VehicleCollector): void {
        collector.targetCollectionArea = this.targetCollectionArea;
        collector.coinDropArea = this.coinDropArea;
        collector.coinPrefab = this.coinPrefab;
        collector.moveSpeed = this.vehicleMoveSpeed;
        collector.dropOffArea = this.dropOffArea;
        
        // 设置车辆完成投放的回调
        collector.node.on('vehicleDropCompleted', this.onVehicleDropCompleted, this);
        collector.node.on('vehicleUploadCompleted', this.onVehicleUploadCompleted, this);
    }

    /**
     * 计算等待区位置
     */
    private calculateWaitingPosition(index: number): Vec3 {
        const basePosition = this.waitingArea.position.clone();
        // 车辆在等待区排成一列
        basePosition.z -= index * this.waitingSpacing;
        return basePosition;
    }

    /**
     * 调度下一辆车
     */
    private dispatchNextVehicle(): void {
        console.log('调度下一辆车');
        if (this._managerState !== VehicleManagerState.IDLE || this._vehicles.length === 0) {
            return;
        }

        // 获取队列中第一辆车（最前面的）
        const nextVehicle = this._vehicles[0];
        if (!nextVehicle || nextVehicle.isActive) {
            return;
        }

        console.log(`调度车辆 #${nextVehicle.id} 前往装货区`);
        
        this._managerState = VehicleManagerState.DISPATCHING;
        this._activeVehicle = nextVehicle;
        nextVehicle.isActive = true;

        // 开始移动到装货区（带转弯）
        this.moveVehicleToLoadingArea(nextVehicle);
    }

    /**
     * 车辆移动到装货区（包含转弯）
     */
    private moveVehicleToLoadingArea(vehicle: VehicleInfo): void {
        const vehicleNode = vehicle.node;
        const startPos = vehicleNode.position.clone();
        const turnPos = this.turnPoint.position.clone();
        const endPos = this.loadingArea.position.clone();

        console.log(`车辆 #${vehicle.id} 开始转弯移动：${startPos} → ${turnPos} → ${endPos}`);

        // 第一段：移动到转弯点
        tween(vehicleNode)
            .to(0.1, { position: this.waitingArea.position }, {
                easing: 'quadInOut'
            })
            .call(() => {
                console.log(`车辆 #${vehicle.id} 到达转弯点`);
            })
            .to(this.turnSpeed, { 
                position: endPos,
                eulerAngles: new Vec3(0, 0, 0)
            }, {
                easing: 'quadInOut'
            })
            .call(() => {
                this.onVehicleArrivedAtLoading(vehicle);
            })
            .start();
    }

    /**
     * 车辆到达装货区
     */
    private onVehicleArrivedAtLoading(vehicle: VehicleInfo): void {
        console.log(`车辆 #${vehicle.id} 到达装货区，开始工作`);
        
        this._managerState = VehicleManagerState.VEHICLE_WORKING;
        
        // 激活车辆的收集器开始工作
        vehicle.collector.triggerCollection();
        
        // 创建新车辆补充等待区
        this.createVehicleInWaitingArea();
        
        // 更新等待区车辆位置
        this.updateWaitingAreaPositions();
    }

    /**
     * 车辆完成投放回调
     */
    private onVehicleDropCompleted(vehicle: Node): void {
        const vehicleInfo = this._vehicles.find(v => v.node === vehicle);
        if (!vehicleInfo) {
            console.error('找不到对应的车辆信息');
            return;
        }

        console.log(`车辆 #${vehicleInfo.id} 完成投放，准备离场`);
        this.removeVehicle(vehicleInfo);
        // 延迟后移除车辆
        // this.scheduleOnce(() => {
        //     this.removeVehicle(vehicleInfo);
        // });
    }

    private onVehicleUploadCompleted(vehicle: Node): void {
        console.log('车辆 完成上传，准备离场');
        // 重置管理器状态
        // this._managerState = VehicleManagerState.IDLE;
        // this.dispatchNextVehicle();
        // 调度下一辆车
        // this.scheduleOnce(() => {
        //     this.dispatchNextVehicle();
        // }, 0.3);
    }

    /**
     * 移除车辆
     */
    private removeVehicle(vehicle: VehicleInfo): void {
        console.log(`移除车辆 #${vehicle.id}`);
        
        // 从队列中移除
        const index = this._vehicles.indexOf(vehicle);
        if (index > -1) {
            this._vehicles.splice(index, 1);
        }
        
        // 销毁车辆节点
        this.scheduleOnce(() => {
            if (vehicle.node && vehicle.node.isValid) {
                vehicle.node.destroy();
            }
        }, 1);

        // 重置管理器状态
        this._managerState = VehicleManagerState.IDLE;
        this._activeVehicle = null;
        
        this.scheduleOnce(() => {
            this.dispatchNextVehicle();
        }, 0.3);
    }

    /**
     * 更新等待区车辆位置
     */
    private updateWaitingAreaPositions(): void {
        let waitingIndex = 0;
        
        for (const vehicle of this._vehicles) {
            if (!vehicle.isActive) {
                const newPosition = this.calculateWaitingPosition(waitingIndex);
                
                // 平滑移动到新位置
                tween(vehicle.node)
                    .to(1.0, { position: newPosition }, {
                        easing: 'quadInOut'
                    })
                    .start();
                    
                waitingIndex++;
            }
        }
        
        console.log(`更新等待区位置，当前等待车辆数: ${waitingIndex}`);
    }

    /**
     * 手动调度车辆（用于测试）
     */
    public manualDispatch(): void {
        console.log('手动调度车辆');
        this.dispatchNextVehicle();
    }

    /**
     * 获取管理器状态信息
     */
    public getManagerInfo(): string {
        const stateNames = ['空闲', '车辆工作中', '调度中'];
        const totalVehicles = this._vehicles.length;
        const activeVehicles = this._vehicles.filter(v => v.isActive).length;
        const waitingVehicles = totalVehicles - activeVehicles;
        
        return `状态: ${stateNames[this._managerState]} | 总车辆: ${totalVehicles} | 工作中: ${activeVehicles} | 等待中: ${waitingVehicles}`;
    }

    /**
     * 重置车辆队列
     */
    public resetVehicleQueue(): void {
        console.log('重置车辆队列');
        
        // 清理所有车辆
        for (const vehicle of this._vehicles) {
            if (vehicle.node && vehicle.node.isValid) {
                vehicle.node.destroy();
            }
        }
        
        this._vehicles.length = 0;
        this._managerState = VehicleManagerState.IDLE;
        this._activeVehicle = null;
        this._vehicleIdCounter = 0;
        
        // 重新初始化
        this.scheduleOnce(() => {
            this.initializeVehicleQueue();
        }, 0.5);
    }

    /**
     * 暂停车辆调度
     */
    public pauseDispatch(): void {
        this._managerState = VehicleManagerState.IDLE;
        console.log('车辆调度已暂停');
    }

    /**
     * 恢复车辆调度
     */
    public resumeDispatch(): void {
        if (this._managerState === VehicleManagerState.IDLE) {
            this.dispatchNextVehicle();
            console.log('车辆调度已恢复');
        }
    }
}
