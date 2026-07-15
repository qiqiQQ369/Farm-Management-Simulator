import { _decorator, Component, Node, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LogoController')
export class LogoController extends Component {
    protected onLoad(): void {
        this.node.active = false;

        this.scheduleOnce(() => {
            var originalScale = this.node.scale.clone();
            this.node.scale = originalScale.clone().multiplyScalar(0.3);
            this.node.active = true;

            tween(this.node)
            .to(0.3, { scale: originalScale.clone().multiplyScalar(1.1) }, { easing: 'backOut' })
            .to(0.2, { scale: originalScale }, { easing: 'backOut' })
            .start();

        }, 30);
    }

    protected onEnable(): void {
        var originalScale = this.node.scale.clone();
            this.node.scale = originalScale.clone().multiplyScalar(0.3);
            this.node.active = true;

            tween(this.node)
            .to(0.3, { scale: originalScale.clone().multiplyScalar(1.1) }, { easing: 'backOut' })
            .to(0.2, { scale: originalScale }, { easing: 'backOut' })
            .start();
    }
}


