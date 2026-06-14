<center>

![logo](./docs/images/logo.png)

</center>

# 七圣召唤模拟器 · Roguelike PvE

本仓库是 [genius-invokation/genius-invokation](https://github.com/genius-invokation/genius-invokation) 的社区 Fork，在原版完备的引擎基础上专攻 **Roguelike PvE 模式**的开发与增强。

---

## 上游

主引擎由 [@Guyutongxue](https://github.com/Guyutongxue) 等人开发并维护，拥有目前最接近官方结算规则的核心实现、全量卡牌定义（含全部历史版本）、跨语言绑定（C / Python / C#）以及功能完备的 Web 对战平台。

| 项目 | 地址 |
|------|------|
| 上游仓库 | [genius-invokation/genius-invokation](https://github.com/genius-invokation/genius-invokation) |
| 在线体验 | https://standalone.piovium.org |
| 对战平台 | https://play.piovium.org |
| Python 绑定 | [gitcg](https://pypi.org/project/gitcg) |
| 本 Fork | [victoroxygenwu/genius-invokation](https://github.com/victoroxygenwu/genius-invokation) |

本仓库完整继承上游引擎的全部能力（结算规则、卡牌数据、跨语言绑定、对战平台），并在此基础上构建 Roguelike 玩法层。Roguelike 特有代码高度集中于 `packages/roguelike/`、`packages/roguelike-data/` 和 `packages/standalone/src/pve/`，与上游代码隔离，便于持续同步。

---

## Roguelike PvE 模式

### 玩法

玩家从 2 名角色起步，穿越多层关卡——战斗、事件、商店——逐步构筑和强化卡组，最终击败 Boss 通关。

```
选角  >  第1层 (战斗 / 事件 / 商店)  >  第2层  >  第3层  >  Boss
```

### 核心设计

**可配置关卡结构**
层数、每层节点数量与顺序、敌人组合、固定事件均可自由编辑。默认配置为 3 层（6 / 5 / 5 节点），可通过关卡编辑器实时调整。

**自定义敌人系统**
9 种修饰器类型——HP 增益、免疫控制、复活、减伤、增伤、固有天赋、圣遗物、支援牌、料理效果。敌人技能通过 Builder DSL 编写脚本，数值由编辑器面板调节，无需修改核心代码。

**动态卡池与权重引擎**
根据队伍组成（元素共鸣、地区共鸣、天赋牌）自动调整奖励和商店的候选卡池。卡牌关联权重基于 Dijkstra 最大乘积路径 + 多源扩散算法计算，驱动智能推荐。权重数据可在编辑器中手动调整。

**事件系统**
15 种条件类型 × 11 种效果类型，支持 AND / OR 条件组合。模板化剧情文本（`{{playerNames}}`、`{{cardName:332001}}` 等可变参数），条件权重以对数缩放（`log2(matchCount + 1)`）防止高数量条件淹没低概率事件。

**敌人 AI**
6 级优先级决策：被控强制切人 → 技能后轮转切人 → 打出手牌 → 使用技能（爆发 > 战技 > 普攻）→ 无行动切人 → 结束回合。切人采用 round-robin 轮转算法。

**经济与存档**
战斗获取货币，商店购买 / 刷新 / 删卡，利息递增。存档基于 IndexedDB，防抖自动写入 + `beforeunload` 同步刷写，支持暂离续玩。

**可视化编辑器**
敌人编辑器、关卡编辑器、事件编辑器、权重编辑器、费用编辑器，通过 Debug 面板访问。

### 技术架构

```
@gi-tcg/core (上游引擎)          结算规则、状态管理、玩家 IO
  └── @gi-tcg/roguelike          纯逻辑层：状态机、卡池、事件、AI、权重
       ├── @gi-tcg/roguelike-data   自定义敌人 / 卡牌定义（Builder DSL）
       ├── @gi-tcg/data/src/pve.ts  PvE 专用状态效果
       └── @gi-tcg/standalone       SolidJS UI：主编排、编辑器面板
```

---

## 开发文档

Roguelike 模式的完整技术文档位于 [docs/development/roguelike.md](./docs/development/roguelike.md)，覆盖以下内容：

- 包结构与依赖关系
- 类型系统（13 种 RunState、EnemyModifier、EventDefinition 等）
- 状态机与完整游戏流程（选角 → 战斗 → 事件 → 商店 → Boss）
- 敌人系统（修饰器解析、技能 Builder DSL、AI 优先级策略）
- 卡池系统（动态生成、权重引擎、Dijkstra / 多源扩散算法）
- 事件系统（条件评估、模板渲染、效果应用、AND / OR 模式）
- 经济系统（货币、利息、商店定价公式）
- 存档系统（IndexedDB、防抖写入、数据结构）
- UI 架构（SolidJS 组件树、状态管理、页面编排）
- 自定义开发指南（敌人、事件、卡牌效果）
- 测试指南与代码规范

其他开发注记见 [docs/development/](./docs/development/README.md)。

---

## 构建与发布

### Web 应用

```sh
pnpm build:roguelike       # 输出到 dist-roguelike/
pnpm preview                # 本地预览构建产物
```

### 桌面应用（Tauri）

Windows 原生桌面应用，支持 MSI 和 NSIS 安装器：

```sh
pnpm build:tauri            # 构建桌面安装包
pnpm dev:tauri              # 开发模式（含热更新）
```

Tauri 配置 — 产品名 `gi-tcg-roguelike`，入口为 roguelike HTML，安装包输出到 `src-tauri/target/release/bundle/`。

### Release

预构建的 Windows 安装包可通过 [GitHub Releases](https://github.com/victoroxygenwu/genius-invokation/releases) 下载。

---

## 开发

```sh
# 环境要求：Node.js >= 22.13
corepack enable && pnpm install

# 启动 Roguelike 开发服务器
pnpm dev:roguelike

# 启动标准对战 UI
pnpm dev

# 构建所有包
pnpm build

# 运行测试
pnpm test
```

开发文档见 [docs/development/](./docs/development/README.md)。

---

## 许可与声明

本项目基于上游 [genius-invokation/genius-invokation](https://github.com/genius-invokation/genius-invokation) 修改，主体代码以 [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html)（或更高版本）发布。详见 [LICENSE](./LICENSE)。

本项目与 HoYoverse 无任何关联，亦未获得其认可。所有与游戏相关的资源、数据和商标归其各自所有者所有。
