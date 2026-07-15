import { _decorator, Component, Node, Vec3, BoxCollider, instantiate,tween,Tween, Collider } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('GuardZone')
export class GuardZone extends Component {
    @property({ type: Node, tooltip: '花朵模型节点' })
    flowerNode: Node = null!;

    @property({ type: Number, tooltip: '生成花朵的数量' })
    spawnCount: number = 50;

    @property({ type: Node, tooltip: '生成区域节点' })
    spawnArea: Node = null!;

    // 存储所有生成的花朵节点
    private allFlowers: Node[] = [];

    start() {
        // 获取生成区域在本地空间的大小
        this.localSize = new Vec3(10, 10, 10); // 默认本地大小
        const collider = this.spawnArea.getComponent(BoxCollider);
        if (collider) {
            // 碰撞体size是本地空间尺寸
             this.localSize = collider.size.clone();
        } else {
            // 无碰撞体时使用节点自身尺寸作为参考（已包含缩放影响）
            // this.localSize = this.spawnArea.contentSize.clone();
        }
        this.GenFlowers();

        // for(let i = 0; i < this.spawnArea.children.length; i++){
        //     this.allFlowers.push(this.spawnArea.children[i]);
        // }
    }


    GenFlowers() {
        if (!this.flowerNode || !this.spawnArea) {
            //console.error('花朵模型或生成区域未设置');
            return;
        }
        for (let i = 0; i < this.spawnCount; i++) {
            
            // 将生成的花朵添加到管理数组中
            this.allFlowers.push(this.createFlower());
        }
    }
    localSize:Vec3 = new Vec3(0,0,0);

    createFlower():Node {
        // 在spawnArea的本地空间内生成随机位置（相对spawnArea的坐标）
        const localX = (Math.random() - 0.5) *  this.localSize.x;
        const localY = Math.random()*0.25+0.3; // 保持在spawnArea的Y轴本地位置（0表示与spawnArea本地中心对齐）
        const localZ = (Math.random() - 0.5) *  this.localSize.z;
        const localPos = new Vec3(localX, localY, localZ);

        // 实例化花朵并设置父节点为spawnArea
        const flower = instantiate(this.flowerNode);
        flower.parent = this.spawnArea;
        // 直接设置本地位置（会自动受spawnArea的旋转、缩放影响）
        flower.position = localPos;

        // 随机3D旋转
        const randomRotation = new Vec3(
            Math.random() * 360,
            Math.random() * 360,
            Math.random() * -120 -30
        );
        flower.eulerAngles = randomRotation;
        return flower;
    }


    /**
     * 隐藏指定的花朵
     * @param index 花朵在数组中的索引
     * @returns 是否成功隐藏
     */
    public hideFlower(flower: Node) {
        for (let i = 0; i < this.allFlowers.length; i++) {
            if (this.allFlowers[i] === flower) {
                this.allFlowers[i] = null;
                // 创建0.2秒缩小动画后消失
                tween(flower)
                    .to(0.2, { scale: new Vec3(0, 0, 0) })
                    .call(() => {
                        flower.destroy();
                    })
                    .start();
                return;
            }
        }
    }

    /**
     * 获取已隐藏的花朵数量
     * @returns 
     */
    public activeFlower(count:number) {
        let activeCount = 0;
        for (let i = 0; i < this.allFlowers.length; i++) {
            if (this.allFlowers[i] == null) {
                const flower = this.createFlower();
                this.allFlowers[i] = flower;
                // if(activeCount++ >= count){
                //     return true;
                // }
            }
        }
    }
}