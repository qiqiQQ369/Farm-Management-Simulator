import { _decorator, Component, Enum } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 树木状态枚举
 */
export enum TreeState {
    Full = 0,      // 完整状态
    Half = 1,      // 半砍状态（隐藏部分树冠）
    Half2 = 2,
    Chopped = 3,   // 砍伐完成（消失状态）
    Respawning = 4 // 重生中
}

/**
 * 树木数据配置
 */
@ccclass('TreeData')
export class TreeData extends Component {
    
    @property({ tooltip: "砍伐所需次数" })
    public chopCount: number = 2;
    
    @property({ tooltip: "每次砍伐所需时间（秒）" })
    public chopDuration: number = 2.0;
    
    @property({ tooltip: "砍伐完成后的重生时间（秒）" })
    public respawnTime: number = 10.0;
    
    @property({ tooltip: "玩家检测半径" })
    public detectionRadius: number = 2.0;
    
    @property({ tooltip: "获得的木材数量" })
    public woodReward: number = 1;
    
    @property({ tooltip: "获得的经验值" })
    public expReward: number = 10;
    
    // 音效配置
    @property({ tooltip: "砍伐音效名称" })
    public chopSoundName: string = "砍木头";
    
    @property({ tooltip: "砍伐完成音效名称" })
    public completeSoundName: string = "收集物品声音";
}
