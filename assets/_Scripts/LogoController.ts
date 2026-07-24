import { _decorator, Component } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LogoController')
export class LogoController extends Component {
    protected onLoad(): void {
        this.node.active = true;
    }
}


