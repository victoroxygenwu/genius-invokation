import { For, Show, createSignal, createMemo } from "solid-js";
import getData from "@gi-tcg/data";
import { CURRENT_VERSION } from "@gi-tcg/core";
import {
  ENCOUNTER_CURRENCY, BASE_HP, TENSHUKAKU_ENTITY_ID, getCardName,
  querySupportCards, queryArtifactCards,
  type EnemyConfig, type EnemyModifier, type EnemyModifierType, type CardEntry,
} from "@gi-tcg/roguelike";
import { configStore } from "./configStore";
import { EditorToolbar } from "./EditorToolbar";
import { OverlayPanel } from "./OverlayPanel";
import { SafeImage } from "./SafeImage";
import { NumberInput } from "./NumberInput";
import { useEditableList } from "./useEditableList";

const data = getData(CURRENT_VERSION);

type Tab = "normal" | "elite" | "boss";

const MODIFIER_LABELS: Record<EnemyModifierType, string> = {
  immuneControl: "免疫控制",
  revive: "多命复活",
  damageReduction: "受伤减免（量×次数）",
  damageBoost: "伤害增加（量×次数）",
  innateTalent: "开局天赋",
  fullEnergy: "开局满能量",
  supportCard: "开局支援牌",
  autoDish: "料理效果",
  innateArtifact: "开局圣遗物",
};

/** 修饰器是否需要额外值输入 */
const MODIFIER_VALUE_TYPE: Record<EnemyModifierType, "none" | "number" | "string" | "support" | "artifact"> = {
  immuneControl: "none",
  revive: "number",
  damageReduction: "number",
  damageBoost: "number",
  innateTalent: "none",   // 自动从 characterId 推断
  fullEnergy: "none",
  supportCard: "support",
  autoDish: "number",
  innateArtifact: "artifact",
};

// 从 GameData 动态查询卡牌列表（模块级缓存，只计算一次）
const SUPPORT_BY_GROUP = querySupportCards(data);
const ARTIFACT_CARDS = queryArtifactCards(data);

/** 获取 modifier 的当前 value（无 value 的类型返回 undefined） */
function getModValue(mod: EnemyModifier): number | undefined {
  return "value" in mod ? mod.value : undefined;
}

function ModifierRow(p: { mod: EnemyModifier; i: number; onUpdate: (i: number, m: EnemyModifier) => void; onRemove: (i: number) => void }) {
  const valueType = () => MODIFIER_VALUE_TYPE[p.mod.type];
  const val = () => getModValue(p.mod);

  return (
    <div class="ee-modifier-row">
      <select class="input-field" value={p.mod.type} onChange={(e) => p.onUpdate(p.i, { type: e.target.value as EnemyModifierType } as EnemyModifier)}>
        <For each={Object.entries(MODIFIER_LABELS)}>{([t, l]) => <option value={t}>{l}</option>}</For>
      </select>
      {/* 数字输入 */}
      <Show when={valueType() === "number"}>
        <span class="ee-mod-label">{p.mod.type === "damageReduction" || p.mod.type === "damageBoost" ? "每次" : ""}</span>
        <NumberInput
          value={typeof val() === "number" ? val() as number : 1}
          min={1}
          max={p.mod.type === "revive" ? 10 : 99}
          onChange={(v) => p.onUpdate(p.i, { ...p.mod, value: v } as EnemyModifier)}
        />
      </Show>
      {/* 伤害减免/增加的触发次数 */}
      <Show when={p.mod.type === "damageReduction" || p.mod.type === "damageBoost"}>
        <span class="ee-mod-label">×次数</span>
        <NumberInput
          value={("value2" in p.mod && typeof p.mod.value2 === "number") ? p.mod.value2 : 1}
          min={1}
          max={99}
          onChange={(v) => p.onUpdate(p.i, { ...p.mod, value2: v } as EnemyModifier)}
        />
      </Show>
      {/* 支援牌选择 */}
      <Show when={valueType() === "support"}>
        <select class="input-field ee-modifier-select" value={typeof val() === "number" ? val() as number : TENSHUKAKU_ENTITY_ID} onChange={(e) => p.onUpdate(p.i, { ...p.mod, value: parseInt(e.target.value) } as EnemyModifier)}>
          <For each={Object.entries(SUPPORT_BY_GROUP)}>{([group, cards]) => (
            <optgroup label={group}><For each={cards}>{(c) => <option value={c.id}>{c.name}</option>}</For></optgroup>
          )}</For>
        </select>
      </Show>
      {/* 圣遗物选择 */}
      <Show when={valueType() === "artifact"}>
        <select class="input-field ee-modifier-select" value={typeof val() === "number" ? val() as number : 312101} onChange={(e) => p.onUpdate(p.i, { ...p.mod, value: parseInt(e.target.value) } as EnemyModifier)}>
          <For each={ARTIFACT_CARDS}>{(c) => <option value={c.id}>{c.name}</option>}</For>
        </select>
      </Show>
      <button class="editor-btn-icon editor-btn-icon-danger" onClick={() => p.onRemove(p.i)}>✕</button>
    </div>
  );
}

function EnemyCard(p: { config: EnemyConfig; tab: Tab; onUpdate: (c: EnemyConfig) => void; showLock?: boolean; onToggleLock?: () => void }) {
  const defaultHp = () => BASE_HP[p.tab] ?? 10;
  const defaultCurrency = () => ENCOUNTER_CURRENCY[p.tab] ?? 5;
  const { add: addMod, update: updateMod, remove: removeMod } = useEditableList(
    () => p.config.modifiers,
    (ms) => p.onUpdate({ ...p.config, modifiers: ms }),
    () => ({ type: "immuneControl" as const }),
  );

  return (
    <div class="ee-card">
      <div class="ee-card-top">
        <SafeImage class="card-item ee-avatar" entityId={p.config.characterId} alt={getCardName(p.config.characterId)} />
        <div class="ee-card-info">
          <div class="ee-name-row">
            <span class="ee-name">{getCardName(p.config.characterId)}</span>
          </div>
          <div class="ee-fields">
            <label class="ee-field">
              <span>HP</span>
              <NumberInput
                value={p.config.hpOverride ?? defaultHp()}
                min={1} max={999}
                onChange={(v) => p.onUpdate({ ...p.config, hpOverride: v })}
              />
            </label>
            <label class="ee-field">
              <span>击败货币</span>
              <NumberInput
                value={p.config.currencyReward ?? defaultCurrency()}
                min={0} max={999}
                onChange={(v) => p.onUpdate({ ...p.config, currencyReward: v })}
              />
            </label>

          </div>
        </div>
      </div>
      <div class="ee-modifiers">
        <div class="ee-modifiers-header">
          <span>特殊效果</span>
          <button class="ee-btn-add" onClick={addMod}>+ 添加效果</button>
        </div>
        <For each={p.config.modifiers}>{(m, i) => <ModifierRow mod={m} i={i()} onUpdate={updateMod} onRemove={removeMod} />}</For>
      </div>
    </div>
  );
}

export type EnemyEditorProps =
  | { mode?: "standalone"; onSave: () => void; onClose: () => void }
  | { mode: "sub"; subConfig: EnemyConfig; subLabel: string; onSubSave: (config: EnemyConfig) => void; onClose: () => void };

export function EnemyEditor(p: EnemyEditorProps) {
  // 子编辑器模式：编辑单个怪物
  if (p.mode === "sub") {
    return <EnemySubEditor config={p.subConfig} label={p.subLabel} onSave={p.onSubSave} onClose={p.onClose} />;
  }

  // 独立模式：编辑全局怪物池
  const [tab, setTab] = createSignal<Tab>("normal");
  const pool = configStore.enemyPool();
  const [pools, setPools] = createSignal(structuredClone(pool));

  const list = createMemo(() => pools()[tab()]);
  const setList = (l: EnemyConfig[]) => setPools((prev) => ({ ...prev, [tab()]: l }));
  const { add, update, remove } = useEditableList(
    list,
    (l) => { setList(l); },
    () => ({ characterId: 0, hpOverride: null, currencyReward: null, modifiers: [{ type: "supportCard" as const, value: TENSHUKAKU_ENTITY_ID }] }),
  );

  const doSave = () => {
    configStore.setEnemyPool(pools());
    p.onSave();
    p.onClose();
  };

  const tabs: { k: Tab; l: string }[] = [
    { k: "normal", l: `普通 (${pools().normal.length})` },
    { k: "elite", l: `精英 (${pools().elite.length})` },
    { k: "boss", l: `Boss (${pools().boss.length})` },
  ];

  return (
    <OverlayPanel title="👾 怪物编辑" onClose={p.onClose}
      titleActions={
        <EditorToolbar
          filename="enemy-config.json"
          getData={pools}
          onImport={(d: { normal: EnemyConfig[]; elite: EnemyConfig[]; boss: EnemyConfig[] }) => setPools({ normal: d.normal ?? [], elite: d.elite ?? [], boss: d.boss ?? [] })}
          onReset={() => { configStore.resetEnemyPool(); setPools(configStore.enemyPool()); }}
        >
          <button class="editor-btn editor-btn-save" onClick={doSave}>保存</button>
        </EditorToolbar>
      }
    >
      <>
        <div class="ee-tabs">
          <For each={tabs}>{(t) => <button class={`ee-tab ${tab() === t.k ? "active" : ""}`} onClick={() => setTab(t.k)}>{t.l}</button>}</For>
        </div>
        <For each={list()}>
          {(cfg, i) => (
            <div class="ee-item">
              <EnemyCard config={cfg} tab={tab()} onUpdate={(c) => update(i(), c)} />
              <button class={`ee-btn-lock ${cfg.locked ? "ee-btn-lock-active" : ""}`} onClick={() => update(i(), { ...cfg, locked: !cfg.locked })} title={cfg.locked ? "已锁定：关卡编辑不会修改此配置" : "未锁定：关卡编辑会同步修改"}>
                {cfg.locked ? "🔒" : "🔓"}
              </button>
              <button class="ee-btn-delete" onClick={() => remove(i())}>删除</button>
            </div>
          )}
        </For>
        <button class="ee-btn-add-enemy" onClick={add}>+ 添加{tab() === "normal" ? "普通" : tab() === "elite" ? "精英" : "Boss"}敌人</button>
      </>
    </OverlayPanel>
  );
}

/** 子编辑器模式：编辑单个怪物的配置 */
function EnemySubEditor(p: { config: EnemyConfig; label: string; onSave: (c: EnemyConfig) => void; onClose: () => void }) {
  const [config, setConfig] = createSignal(structuredClone(p.config));
  const tab = createMemo((): Tab => {
    // 根据 characterId 推断 tier
    const id = config().characterId;
    const pool = configStore.enemyPool();
    if (pool.boss.some((c) => c.characterId === id)) return "boss";
    if (pool.elite.some((c) => c.characterId === id)) return "elite";
    return "normal";
  });

  return (
    <OverlayPanel title={`👾 编辑怪物 [${p.label}]`} onClose={p.onClose} maxWidth="500px" zIndex={1100}
      titleActions={
        <button class="editor-btn editor-btn-save" onClick={() => { p.onSave(config()); p.onClose(); }}>保存</button>
      }
    >
      <EnemyCard config={config()} tab={tab()} onUpdate={setConfig} />
    </OverlayPanel>
  );
}
