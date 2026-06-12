import type { RoguelikeRunManager, RoguelikeRun, EventDefinition } from "@gi-tcg/roguelike";

/**
 * 调试运行控制器。
 * 封装 RoguelikeRunManager 的调试 API，供 DebugPanel、EventTestPanel 等 UI 组件使用。
 */
export class DebugRunController {
  constructor(private manager: RoguelikeRunManager) {}

  /** 覆盖运行状态 */
  setRun(partial: Partial<RoguelikeRun>): void {
    this.manager.setRun(partial);
  }

  /** 用指定角色和货币快速初始化 run */
  quickStart(characterIds: number[], currency: number): void {
    this.manager.quickStart(characterIds, currency);
  }

  /** 直接进入指定事件（用于事件测试） */
  enterEvent(event: EventDefinition, characterIds?: number[], onConfirm?: () => void): void {
    this.manager.enterEvent(event, characterIds, onConfirm);
  }

  /** 直接应用事件效果（无 UI，用于事件测试面板） */
  applyEvent(event: EventDefinition): void {
    this.manager.applyEvent(event);
  }
}
