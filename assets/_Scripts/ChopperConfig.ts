import { _decorator, Component } from 'cc';
import { ChopperType } from './Tree';
const { ccclass, property } = _decorator;

/**
 * 砍伐者配置数据
 * 定义不同类型砍伐者的砍伐参数
 */
@ccclass('ChopperConfig')
export class ChopperConfig extends Component {
    
    // 玩家砍伐配置
    @property({ tooltip: "玩家砍伐次数" })
    public playerChopCount: number = 2;
    
    @property({ tooltip: "玩家砍伐时间（秒）" })
    public playerChopDuration: number = 2.0;
    
    @property({ tooltip: "玩家砍伐效率" })
    public playerEfficiency: number = 1.0;
    
    @property({ tooltip: "玩家木材获得倍率" })
    public playerWoodMultiplier: number = 1.0;
    
    @property({ tooltip: "玩家经验获得倍率" })
    public playerExpMultiplier: number = 1.0;
    
    // 伐木工砍伐配置
    @property({ tooltip: "伐木工砍伐次数" })
    public woodcutterChopCount: number = 1;
    
    @property({ tooltip: "伐木工砍伐时间（秒）" })
    public woodcutterChopDuration: number = 1.5;
    
    @property({ tooltip: "伐木工砍伐效率" })
    public woodcutterEfficiency: number = 1.2;
    
    @property({ tooltip: "伐木工木材获得倍率" })
    public woodcutterWoodMultiplier: number = 0.8;
    
    @property({ tooltip: "伐木工经验获得倍率" })
    public woodcutterExpMultiplier: number = 0.5;
    
    // 伐木车砍伐配置
    @property({ tooltip: "伐木车砍伐次数" })
    public vehicleChopCount: number = 3;
    
    @property({ tooltip: "伐木车砍伐时间（秒）" })
    public vehicleChopDuration: number = 3.0;
    
    @property({ tooltip: "伐木车砍伐效率" })
    public vehicleEfficiency: number = 1.5;
    
    @property({ tooltip: "伐木车木材获得倍率" })
    public vehicleWoodMultiplier: number = 1.2;
    
    @property({ tooltip: "伐木车经验获得倍率" })
    public vehicleExpMultiplier: number = 0.8;
    
    /**
     * 获取指定类型砍伐者的配置
     */
    public getChopperConfig(type: ChopperType): {
        chopCount: number,
        chopDuration: number,
        efficiency: number,
        woodMultiplier: number,
        expMultiplier: number
    } {
        switch (type) {
            case ChopperType.Player:
                return {
                    chopCount: this.playerChopCount,
                    chopDuration: this.playerChopDuration,
                    efficiency: this.playerEfficiency,
                    woodMultiplier: this.playerWoodMultiplier,
                    expMultiplier: this.playerExpMultiplier
                };
                
            case ChopperType.Woodcutter:
                return {
                    chopCount: this.woodcutterChopCount,
                    chopDuration: this.woodcutterChopDuration,
                    efficiency: this.woodcutterEfficiency,
                    woodMultiplier: this.woodcutterWoodMultiplier,
                    expMultiplier: this.woodcutterExpMultiplier
                };
                
            case ChopperType.Vehicle:
                return {
                    chopCount: this.vehicleChopCount,
                    chopDuration: this.vehicleChopDuration,
                    efficiency: this.vehicleEfficiency,
                    woodMultiplier: this.vehicleWoodMultiplier,
                    expMultiplier: this.vehicleExpMultiplier
                };
                
            default:
                return {
                    chopCount: 1,
                    chopDuration: 2.0,
                    efficiency: 1.0,
                    woodMultiplier: 1.0,
                    expMultiplier: 1.0
                };
        }
    }
    
    /**
     * 设置玩家砍伐配置
     */
    public setPlayerConfig(chopCount: number, chopDuration: number, efficiency: number): void {
        this.playerChopCount = chopCount;
        this.playerChopDuration = chopDuration;
        this.playerEfficiency = efficiency;
    }
    
    /**
     * 设置伐木工砍伐配置
     */
    public setWoodcutterConfig(chopCount: number, chopDuration: number, efficiency: number): void {
        this.woodcutterChopCount = chopCount;
        this.woodcutterChopDuration = chopDuration;
        this.woodcutterEfficiency = efficiency;
    }
    
    /**
     * 设置伐木车砍伐配置
     */
    public setVehicleConfig(chopCount: number, chopDuration: number, efficiency: number): void {
        this.vehicleChopCount = chopCount;
        this.vehicleChopDuration = chopDuration;
        this.vehicleEfficiency = efficiency;
    }
}
