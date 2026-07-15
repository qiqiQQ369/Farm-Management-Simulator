import { _decorator, Component, sys } from 'cc';
const { ccclass, property } = _decorator;

// 定义一个事件类型常量
export const GAME_EVENT = {
    GAME_OVER: 'game-over',
    SCORE_CHANGED: 'score-changed',
    CONSUME_COMPLETE: 'consume-complete'
};

@ccclass('GameManager')
export class GameManager extends Component {

     //安卓平台
     private url_Android: string = "https://play.google.com/store/apps/details?id=com.monopoly.dream.idle.king&hl=en_Uk&gl=uk";
     //IOS平台
     private url_IOS: string = "https://apps.apple.com/gb/app/top-tycoon-coin-theme-empire/id6739124364";
 
     public goUrl() {
         const isIOS = (sys.isNative && sys.os === sys.OS.IOS);
         const targetUrl = isIOS ? this.url_IOS : this.url_Android;
 
         if (typeof mraid !== 'undefined') {
             // 检查 MRAID 是否已经准备就绪
             if (mraid.getState() === 'loading') {
                 // 如果还在加载，等它准备好后再执行跳转
                 mraid.addEventListener('ready', () => {
                     mraid.open(targetUrl);
                 });
             } else {
                 // 如果已经准备就绪，直接跳转
                 mraid.open(targetUrl);
             }
         } else {
             // ... 你的备用方案 (sys.openURL 等) ...
             sys.openURL(targetUrl); // 或者你的其他备选逻辑
         }
         if(window.super_html_channel == "unity"){
             window.location.href = targetUrl;
             window.open(targetUrl, '_blank');
             mraid.open(targetUrl);
         }
     }

    // private onConsumeComplete(eventNode: Node) {
    //     console.log('onConsumeComplete: ', eventNode.name);

    //     if(eventNode.name === '工具升级'){
    //         var player = find('Player');
    //         player.getComponent(MowGrass).upgradeMowTool();
    //         //player.getChildByName("ResourceBag").getComponent(ResourceStorage).capacity = 40;
    //         this.onMowToolUpgrade();
    //         this.audioSource.playOneShot(this.audioClip);
    //     }
    //     else if(eventNode.name.includes('帮工解锁')){
    //         console.log('帮工解锁: ', eventNode.name);
    //         this.workerUnlockCount++;

    //         if(this.workerUnlockCount >= 4){
    //             find('地贴').getChildByName('工具升级').active = true;

    //             var playerCoin = this.playerCoinBag.getComponent(ResourceStorage).resourceCount;
    //             var storageCoin = find("地贴/CoinStorage").getComponent(ResourceStorage).resourceCount;

    //             if(playerCoin + storageCoin >= 30){
    //                 this.sellLevel2 = true;
    //                 director.emit("advancedAreaOpen", this.node);
    //             }
    //         }

    //         if(this.workerUnlockCount == 1){
    //             var delay = 0;
    //             for(let i = 0; i < this.unlockFence1.length; i++){
    //                 var fenceNode = this.unlockFence1[i];
    //                 var targetPosition = fenceNode.position.clone();
    //                 targetPosition.y = -6;
    //                 tween(fenceNode)
    //                 .delay(delay)
    //                 .to(0.3, { position: targetPosition }, { easing: "quadIn" })
    //                 .call(() => {
    //                     fenceNode.active = false;
    //                 })
    //                 .start();
    //                 delay += 0.08;
    //             }
    //         }
    //     }
    //     else if(eventNode.name.includes('扩建')){
    //         console.log('扩建: ', eventNode.name);
    //         this.scheduleOnce(() => {
    //             find('Canvas').getChildByName('JoystickContainer').getComponent(JoystickController).removeEventListeners();
    //             find('Canvas').getChildByName('winShow').active = true;
    //         }, 0.5);
    //     }
    // }

    // private onMowToolUpgrade(): void {

    //     this.advancedAreaIsOpen = true;

    //     this.grassStoragePoint.node.active = false;
    //     this.grassStorageGreen.node.parent.active = true;

    //     //解锁围栏
    //     var delay = 0;
    //     for(let i = 0; i < this.unlockFence2.length; i++){
    //         var fenceNode = this.unlockFence2[i];
    //         var targetPosition = fenceNode.position.clone();
    //         targetPosition.y = -5;
    //         tween(fenceNode)
    //         .delay(delay)
    //         .to(0.3, { position: targetPosition }, { easing: "quadIn" })
    //         .start();
    //         delay += 0.08;
    //     }

    //     //为不同的工人分配存储点
    //     var workers = find('Workers');
    //     for(let i = 1; i <= 4; i++){
    //         let worker = workers.getChildByName('Worker' + i);
    //         var storagePoint = i <= 2 ? this.grassStorageYellow : this.grassStorageGreen;
    //         var workerController = worker.getComponent(WorkerController);
            
    //         //清空工人背包
    //         var workerStorage = worker.getComponent(ResourceStorage);
    //         workerStorage.removeAllResource();

    //         //重新分配
    //         workerController.setStoragePoint(storagePoint);
    //         workerController.setTargetPoint(this.node.getChildByName('workerTarget' + (i + 2)));

    //         var resourceOperator = worker.getComponent(ResourceOperator);
    //         if(resourceOperator)
    //             resourceOperator.targetStorage = storagePoint;
    //     }
    //     //临时添加资源
    // }

    // public consumeCoin(coin: number): void {
    //     this.coin -= coin;
    //     this.coinLabel.string = this.coin.toString();
    // }

    // private onResourceChanged(eventData: any) {
    //     var resourceStorage = eventData as ResourceStorage;
    //     this.playerCoinBag.position = new Vec3(0, 0.6, resourceStorage.resourceCount > 0 ? 2.4 : 1.2);
    // }

    // update(dt: number): void {
    //     if(this.sellLevel2 || this.workerUnlockCount < 4) return;
    //     var playerCoin = this.playerCoinBag.getComponent(ResourceStorage).resourceCount;
    //     var storageCoin = find("地贴/CoinStorage").getComponent(ResourceStorage).resourceCount;

    //     if(playerCoin + storageCoin >= 30){
    //         this.sellLevel2 = true;
    //         this.scheduleOnce(() => {
    //             director.emit("advancedAreaOpen", this.node);
    //         }, 1);
    //         //director.emit("advancedAreaOpen", this.node);
    //     }
    // }
}