import { For, Show, createSignal } from "solid-js";
import {
  getCardName, generateFloorPath, sample,
  type RoguelikeConfig, type FloorConfig, type NodeType, type EnemyConfig, type EventDefinition,
} from "@gi-tcg/roguelike";
import { getLevelConfig, setLevelConfig, getEnemyPool, setEnemyPoolConfig, configStore, exportJson, importJson } from "./configStore";
import { NODE_INFO } from "./nodeInfo";
import { EnemyEditor } from "./EnemyEditor";
import { EventEditor } from "./EventEditor";
import { OverlayPanel } from "./OverlayPanel";
import { SafeImage } from "./SafeImage";
import { NumberInput } from "./NumberInput";
import type { EnemyPool } from "./configStore";

interface PathNodeCfg { type: NodeType; encounters: EnemyConfig[][] | null; }
interface FloorCfgEx { floor: number; path: PathNodeCfg[]; }

/** 对 null 遭遇使用与游戏相同的 generateFloorPath 预生成 */
function prefillEncounters(fc: FloorConfig, pool: EnemyPool): FloorCfgEx {
  const hasNull = fc.encounters?.some((e) => e === null) ?? true;
  if (!hasNull && fc.encounters) {
    // 所有遭遇已设定，直接转换
    return {
      floor: fc.floor,
      path: fc.path.map((t, i) => ({ type: t, encounters: fc.encounters?.[i] ?? null })),
    };
  }
  // 使用与游戏相同的 generateFloorPath 生成遭遇
  const pathNodes = generateFloorPath(fc.path, fc.encounters ?? undefined, pool);
  return {
    floor: fc.floor,
    path: fc.path.map((t, i) => ({
      type: t,
      encounters: pathNodes[i]?.encounters?.map((enc) => enc.configs) ?? null,
    })),
  };
}

/** 敌人卡片选择器 — 缩略图 + 名称 */
function EnemyPicker(p: { selected: number; pool: EnemyConfig[]; onChange: (id: number) => void }) {
  return (
    <div class="card-grid le-enemy-picker">
      <For each={p.pool}>{(en) => (
        <button
          class={`card-item le-enemy-card ${p.selected === en.characterId ? "le-enemy-card-selected" : ""}`}
          onClick={() => p.onChange(en.characterId)}
        >
          <SafeImage entityId={en.characterId} alt={getCardName(en.characterId)} />
          <span>{getCardName(en.characterId)}</span>
        </button>
      )}</For>
    </div>
  );
}

/** 从池子中查找怪物模板，未找到则返回基本默认配置 */
function getTemplateFromPool(pool: EnemyConfig[], characterId: number): EnemyConfig {
  const found = pool.find((c) => c.characterId === characterId);
  if (found) return { ...found };
  return { characterId, hpOverride: null, currencyReward: null, modifiers: [] };
}

/** 单个遭遇编辑 */
function EncounterEditor(p: {
  configs: EnemyConfig[];
  pool: EnemyConfig[];
  onUpdate: (configs: EnemyConfig[]) => void;
  onRemove: () => void;
  onEditEnemy: (index: number) => void;
  label?: string;
}) {
  const addEnemy = () => {
    // 添加占位配置，选择敌人时会从模板读取
    const placeholder: EnemyConfig = { characterId: 0, hpOverride: null, currencyReward: null, modifiers: [] };
    p.onUpdate([...p.configs, placeholder]);
  };
  const removeEnemy = (i: number) => p.onUpdate(p.configs.filter((_, idx) => idx !== i));
  const selectEnemy = (i: number, id: number) => {
    // 从池子模板读取完整配置（包含效果列表）
    const template = getTemplateFromPool(p.pool, id);
    const nc = [...p.configs];
    nc[i] = template;
    p.onUpdate(nc);
  };

  return (
    <div class="le-encounter">
      <div class="le-encounter-selected">
        <For each={p.configs}>{(cfg, i) => (
          <Show when={cfg.characterId > 0} fallback={
            <div class="le-encounter-empty">
              <span>选择敌人</span>
              <EnemyPicker selected={0} pool={p.pool} onChange={(nid) => selectEnemy(i(), nid)} />
            </div>
          }>
            <div class="le-encounter-enemy">
              <SafeImage entityId={cfg.characterId} />
              <span>{getCardName(cfg.characterId)}</span>
              <Show when={cfg.modifiers.length > 0 || cfg.hpOverride !== null}>
                <span class="le-encounter-mod-badge">✨{cfg.modifiers.length}</span>
              </Show>
              <button class="editor-btn-icon editor-btn-icon-blue" title="编辑怪物" onClick={() => p.onEditEnemy(i())}>✏️</button>
              <button class="editor-btn-icon editor-btn-icon-danger" onClick={() => removeEnemy(i())}>✕</button>
            </div>
          </Show>
        )}</For>
      </div>
      <div class="le-encounter-actions">
        <Show when={p.configs.length < 4}>
          <button class="le-encounter-action-add" onClick={addEnemy}>+ 添加敌人</button>
        </Show>
        <button class="le-encounter-action-delete" onClick={p.onRemove}>删除遭遇</button>
      </div>
      <Show when={p.configs.some((c) => c.characterId === 0)}>
        <div class="le-encounter-pick-hint">点击上方卡片选择敌人</div>
      </Show>
    </div>
  );
}

/** 单层编辑（竖版布局） */
function FloorRow(p: {
  cfg: FloorCfgEx;
  floorIndex: number;
  onUpdate: (c: FloorCfgEx) => void;
  onRemove: () => void;
  canRemove: boolean;
  onEditEnemy: (floorIdx: number, nodeIdx: number, encIdx: number, enemyIdx: number) => void;
  onEditEvent: (floorIdx: number, nodeIdx: number) => void;
}) {
  // 直接读取信号，确保响应式追踪
  const poolFor = (t: NodeType): EnemyConfig[] => {
    const ep = configStore.enemyPool();
    if (t === "normal") return ep.normal; if (t === "elite") return ep.elite; if (t === "boss") return ep.boss;
    return [];
  };
  /** 创建默认遭遇：使用与游戏相同的 sample 函数从池子选取 */
  const defaultConfigs = (pool: EnemyConfig[]): EnemyConfig[] => {
    if (pool.length === 0) return [{ characterId: 0, hpOverride: null, currencyReward: null, modifiers: [] }];
    return sample(pool, 1).map((c) => ({ ...c }));
  };

  return (
    <div class="le-floor">
      <div class="le-floor-header">
        <span class="le-floor-label">第 {p.cfg.floor} 层</span>
        <Show when={p.canRemove}><button class="ee-btn-delete" onClick={p.onRemove} style={{ position: "static" }}>删除层</button></Show>
      </div>
      <div class="le-floor-nodes">
        <For each={p.cfg.path}>{(node, ni) => {
          const pool = poolFor(node.type);
          const encs = node.encounters ?? [defaultConfigs(pool)];
          return (
            <div class="le-node">
              <div class="le-node-header">
                <span class="le-node-type">{NODE_INFO[node.type].icon} {NODE_INFO[node.type].name}</span>
                <button class="ee-btn-delete" onClick={() => p.onUpdate({ ...p.cfg, path: p.cfg.path.filter((_, i) => i !== ni()) })} style={{ position: "static" }}>✕</button>
              </div>
              <Show when={node.type !== "shop" && node.type !== "event"}>
                <div class="le-node-encounters">
                  <For each={encs}>{(configs, ei) => (
                    <EncounterEditor configs={configs} pool={pool}
                      onUpdate={(nc) => { const np = [...p.cfg.path]; const ne = [...(np[ni()].encounters ?? encs)]; ne[ei()] = nc; np[ni()] = { ...np[ni()], encounters: ne }; p.onUpdate({ ...p.cfg, path: np }); }}
                      onRemove={() => { const np = [...p.cfg.path]; const ne = [...(np[ni()].encounters ?? encs)]; ne.splice(ei(), 1); np[ni()] = { ...np[ni()], encounters: ne.length > 0 ? ne : null }; p.onUpdate({ ...p.cfg, path: np }); }}
                      onEditEnemy={(enemyIdx) => p.onEditEnemy(p.floorIndex, ni(), ei(), enemyIdx)}
                    />
                  )}</For>
                  <button class="editor-btn-add-enc" onClick={() => { const np = [...p.cfg.path]; np[ni()] = { ...np[ni()], encounters: [...(np[ni()].encounters ?? encs), defaultConfigs(pool)] }; p.onUpdate({ ...p.cfg, path: np }); }}>+ 添加遭遇</button>
                </div>
              </Show>
              <Show when={node.type === "event"}>
                <div class="le-node-event">
                  <p class="pve-debug-hint">运行时从全局事件池中按条件随机选取</p>
                  <button class="editor-btn editor-btn-blue" onClick={() => p.onEditEvent(p.floorIndex, ni())}>
                    📜 编辑事件
                  </button>
                </div>
              </Show>
            </div>
          );
        }}</For>
        <div class="le-node-add">
          <For each={(["normal", "elite", "shop", "boss", "event"] as NodeType[])}>
            {(t) => <button class="le-node-add-btn" onClick={() => {
              // 使用与游戏相同的 generateFloorPath 预生成遭遇
              const ep = configStore.enemyPool();
              const pathNodes = generateFloorPath([...p.cfg.path.map((n) => n.type), t], undefined, ep);
              const newNode = pathNodes[pathNodes.length - 1];
              const newEncounters = newNode?.encounters?.map((enc) => enc.configs) ?? null;
              p.onUpdate({ ...p.cfg, path: [...p.cfg.path, { type: t, encounters: newEncounters }] });
            }}>{NODE_INFO[t].icon} {NODE_INFO[t].name}</button>}
          </For>
        </div>
      </div>
    </div>
  );
}

export function LevelEditor(p: { onSave: () => void; onClose: () => void }) {
  const cfg = getLevelConfig();
  const pool = getEnemyPool();
  // 从 FloorConfig 加载，对 null 遭遇使用与游戏相同的 generateFloorPath 预生成
  const toEx = (fc: FloorConfig): FloorCfgEx => prefillEncounters(fc, pool);

  const initialFloors = cfg.floors.map(toEx);
  const [floors, setFloors] = createSignal(initialFloors);

  // 如果有 null 遭遇被预生成，自动保存到 configStore（确保测试流程使用相同数据）
  const hasNull = cfg.floors.some((fc) => fc.encounters?.some((e) => e === null) ?? true);
  if (hasNull) {
    const autoSaveConfig: RoguelikeConfig = {
      floors: initialFloors.map((f) => ({
        floor: f.floor,
        path: f.path.map((n) => n.type),
        encounters: f.path.map((n) => n.encounters ?? null),
      })),
      initialCurrency: cfg.initialCurrency,
      shopCardCount: cfg.shopCardCount,
      rewardCardCount: cfg.rewardCardCount,
      interestThreshold: cfg.interestThreshold,
      interestRate: cfg.interestRate,
      events: cfg.events ?? [],
    };
    setLevelConfig(autoSaveConfig);
  }
  const [initialCurrency, setInitialCurrency] = createSignal(cfg.initialCurrency);
  const [shopCardCount, setShopCardCount] = createSignal(cfg.shopCardCount);
  const [rewardCardCount, setRewardCardCount] = createSignal(cfg.rewardCardCount);
  const [interestThreshold, setInterestThreshold] = createSignal(cfg.interestThreshold);
  const [interestRate, setInterestRate] = createSignal(cfg.interestRate);

  // 子编辑器状态：从 LevelEditor 打开 EnemyEditor 编辑特定怪物
  const [editingEnemy, setEditingEnemy] = createSignal<{
    floorIdx: number; nodeIdx: number; encIdx: number; enemyIdx: number;
  } | null>(null);

  // 事件编辑器状态
  const [showEventEditor, setShowEventEditor] = createSignal(false);
  const [editingEventNode, setEditingEventNode] = createSignal<{
    floorIdx: number; nodeIdx: number;
  } | null>(null);

  const updateFloor = (i: number, f: FloorCfgEx) => { const l = [...floors()]; l[i] = f; setFloors(l); };
  const removeFloor = (i: number) => setFloors(floors().filter((_, idx) => idx !== i));
  const addFloor = () => { const last = floors()[floors().length - 1]; setFloors([...floors(), { floor: (last?.floor ?? 0) + 1, path: [{ type: "normal", encounters: null }, { type: "normal", encounters: null }, { type: "elite", encounters: null }, { type: "shop", encounters: null }, { type: "boss", encounters: null }] }]); };

  const buildConfig = (): RoguelikeConfig => ({
    floors: floors().map((f) => ({
      floor: f.floor,
      path: f.path.map((n) => n.type),
      encounters: f.path.map((n) => n.encounters ?? null),
    })),
    initialCurrency: initialCurrency(), shopCardCount: shopCardCount(), rewardCardCount: rewardCardCount(),
    interestThreshold: interestThreshold(), interestRate: interestRate(),
    events: configStore.events(),
  });

  const doSave = () => { setLevelConfig(buildConfig()); p.onSave(); p.onClose(); };

  /** 打开子编辑器编辑特定怪物 */
  const openEnemyEditor = (floorIdx: number, nodeIdx: number, encIdx: number, enemyIdx: number) => {
    setEditingEnemy({ floorIdx, nodeIdx, encIdx, enemyIdx });
  };

  /** 打开事件编辑器 */
  const openEventEditor = (floorIdx: number, nodeIdx: number) => {
    setEditingEventNode({ floorIdx, nodeIdx });
    setShowEventEditor(true);
  };

  /** 子编辑器保存回调 */
  const onEnemySubSave = (updatedConfig: EnemyConfig) => {
    const loc = editingEnemy();
    if (!loc) return;
    const fl = [...floors()];
    const node = fl[loc.floorIdx].path[loc.nodeIdx];
    if (!node.encounters) return;
    const ne = [...node.encounters];
    const enc = [...ne[loc.encIdx]];
    enc[loc.enemyIdx] = updatedConfig;
    ne[loc.encIdx] = enc;
    fl[loc.floorIdx] = {
      ...fl[loc.floorIdx],
      path: fl[loc.floorIdx].path.map((n, i) =>
        i === loc.nodeIdx ? { ...n, encounters: ne } : n
      ),
    };
    setFloors(fl);

    // 如果怪物未锁定，写回全局怪物池
    // 同时检查池子中原始条目的锁定状态，防止锁定怪物被意外覆盖
    const currentPool = getEnemyPool();
    const charId = updatedConfig.characterId;
    const isLockedInPool =
      currentPool.normal.some((c) => c.characterId === charId && c.locked) ||
      currentPool.elite.some((c) => c.characterId === charId && c.locked) ||
      currentPool.boss.some((c) => c.characterId === charId && c.locked);
    if (!updatedConfig.locked && !isLockedInPool) {
      const findAndUpdate = (list: EnemyConfig[]): EnemyConfig[] => {
        const idx = list.findIndex((c) => c.characterId === charId);
        if (idx >= 0) {
          const newList = [...list];
          newList[idx] = { ...updatedConfig, locked: list[idx].locked };
          return newList;
        }
        return list;
      };
      setEnemyPoolConfig({
        normal: findAndUpdate(currentPool.normal),
        elite: findAndUpdate(currentPool.elite),
        boss: findAndUpdate(currentPool.boss),
      });
    }

    setEditingEnemy(null);
  };

  // 获取当前编辑的怪物配置和标签
  const editingConfig = () => {
    const loc = editingEnemy();
    if (!loc) return null;
    const node = floors()[loc.floorIdx]?.path[loc.nodeIdx];
    const cfg = node?.encounters?.[loc.encIdx]?.[loc.enemyIdx];
    if (!cfg) return null;
    const label = `${loc.floorIdx + 1}-${loc.nodeIdx + 1}-${loc.encIdx + 1}-${loc.enemyIdx + 1}`;
    return { config: cfg, label };
  };

  return (
    <>
      <OverlayPanel title="🗺️ 关卡编辑" onClose={p.onClose}
        titleActions={<>
          <button class="editor-btn" onClick={async () => { const d = await importJson<RoguelikeConfig>(); if (d) { if (d.floors) setFloors(d.floors.map(toEx)); if (d.initialCurrency !== undefined) setInitialCurrency(d.initialCurrency); if (d.shopCardCount !== undefined) setShopCardCount(d.shopCardCount); if (d.rewardCardCount !== undefined) setRewardCardCount(d.rewardCardCount); if (d.interestThreshold !== undefined) setInterestThreshold(d.interestThreshold); if (d.interestRate !== undefined) setInterestRate(d.interestRate); } }}>导入</button>
          <button class="editor-btn" onClick={() => exportJson(buildConfig(), "level-config.json")}>导出</button>
          <button class="editor-btn editor-btn-save" onClick={doSave}>保存</button>
        </>}
      >
        <>
          <div class="le-section">
            <h3>全局参数</h3>
            <div class="le-global-fields">
              <label class="le-field"><span>初始货币</span><NumberInput value={initialCurrency()} min={0} onChange={setInitialCurrency} /></label>
              <label class="le-field"><span>商店卡数</span><NumberInput value={shopCardCount()} min={1} max={20} onChange={setShopCardCount} /></label>
              <label class="le-field"><span>奖励卡数</span><NumberInput value={rewardCardCount()} min={1} max={10} onChange={setRewardCardCount} /></label>
              <label class="le-field"><span>利息阈值</span><NumberInput value={interestThreshold()} min={0} onChange={setInterestThreshold} /></label>
              <label class="le-field"><span>每利息货币</span><NumberInput value={interestRate()} min={1} onChange={setInterestRate} /></label>
            </div>
          </div>
          <div class="le-section">
            <h3>关卡路径</h3>
            <p class="le-hint">每层可配置节点序列和敌人组合。满 4 人后自动跳过选人。点击 ✏️ 编辑怪物的特殊效果。</p>
            <div class="le-floors">
              <For each={floors()}>{(fc, i) => (
                <FloorRow cfg={fc} floorIndex={i()}
                  onUpdate={(c) => updateFloor(i(), c)}
                  onRemove={() => removeFloor(i())}
                  canRemove={floors().length > 1}
                  onEditEnemy={openEnemyEditor}
                  onEditEvent={openEventEditor}
                />
              )}</For>
            </div>
            <button class="le-btn-add-floor" onClick={addFloor}>+ 添加新层</button>
          </div>
        </>
      </OverlayPanel>

      {/* 子编辑器：编辑特定怪物 */}
      <Show when={editingEnemy() !== null && editingConfig() !== null}>
        <EnemyEditor
          mode="sub"
          subConfig={editingConfig()!.config}
          subLabel={editingConfig()!.label}
          onSubSave={onEnemySubSave}
          onClose={() => setEditingEnemy(null)}
        />
      </Show>

      {/* 事件编辑器：编辑全局事件池 */}
      <Show when={showEventEditor()}>
        <EventEditor
          mode="standalone"
          onSave={() => {
            // 事件保存到 configStore，下次创建 runManager 时会自动读取
          }}
          onClose={() => {
            setShowEventEditor(false);
            setEditingEventNode(null);
          }}
        />
      </Show>
    </>
  );
}
