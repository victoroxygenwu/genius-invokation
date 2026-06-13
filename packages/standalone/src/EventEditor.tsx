import { For, Show, createSignal } from "solid-js";
import getRoguelikeData from "@gi-tcg/roguelike-data";
import { CURRENT_VERSION } from "@gi-tcg/core";
import {
  DEFAULT_EVENTS, generateCharacterPool, CARD_TAG_LABELS,
  CONDITION_DESCRIPTORS, EFFECT_DESCRIPTORS,
  type EventDefinition, type EventCondition, type EventConditionType,
  type EventEffectType, type CardEntry, type FieldDescriptor,
} from "@gi-tcg/roguelike";
import { getCardName } from "./roguelike-assets";
import { configStore } from "./configStore";
import { OverlayPanel } from "./OverlayPanel";
import { EditorToolbar } from "./EditorToolbar";
import { NumberInput } from "./NumberInput";
import { useEditableList } from "./useEditableList";
import { CardImageSelect } from "./CardImageSelect";

const data = getRoguelikeData(CURRENT_VERSION);

/** 生成完整卡牌列表（含天赋牌、共鸣牌，用于事件编辑选择器） */
function getCardItems(): CardEntry[] {
  const items: CardEntry[] = [];
  for (const [id, def] of data.entities) {
    if (def.type === "status" || def.type === "combatStatus" || def.type === "summon") continue;
    // 包含天赋牌(2xxxxx)、所有行动牌(3xxxxx)
    if ((id >= 200000 && id < 400000)) {
      items.push({ id, name: getCardName(id) });
    }
  }
  return items;
}

/** 生成角色列表（用于角色选择器） */
function getCharacterItems(): CardEntry[] {
  const pool = generateCharacterPool(data);
  return pool.map((c) => ({ id: c.id, name: c.name }));
}

// 缓存列表，避免每次渲染重新生成
const CARD_ITEMS: CardEntry[] = getCardItems();
const CHARACTER_ITEMS: CardEntry[] = getCharacterItems();
/** 敌人列表（从怪物池中提取） */
function getEnemyItems(): CardEntry[] {
  const pool = configStore.enemyPool();
  const all = [...pool.normal, ...pool.elite, ...pool.boss];
  const seen = new Set<number>();
  return all.filter((e) => { if (seen.has(e.characterId)) return false; seen.add(e.characterId); return true; })
    .map((e) => ({ id: e.characterId, name: getCardName(e.characterId) }));
}

// ============================================================
// 通用字段渲染器
// ============================================================

function FieldRenderer(p: {
  field: FieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const getItems = (kind: string): CardEntry[] => {
    if (kind === "card") return CARD_ITEMS;
    if (kind === "character") return CHARACTER_ITEMS;
    if (kind === "enemy") return getEnemyItems();
    return [];
  };

  return (
    <>
      {/* label 前缀 */}
      {p.field.label && <span class="ee-weight-label">{p.field.label} </span>}

      {/* number */}
      <Show when={p.field.type === "number"}>
        <NumberInput value={(p.value as number) ?? 0}
          min={(p.field as any).min} max={(p.field as any).max}
          onChange={p.onChange} />
      </Show>

      {/* entityId */}
      <Show when={p.field.type === "entityId"}>
        <CardImageSelect value={(p.value as number) ?? 0}
          items={getItems((p.field as any).entityKind)}
          onChange={p.onChange} placeholder="选择..." />
      </Show>

      {/* select */}
      <Show when={p.field.type === "select"}>
        <select class="input-field" value={(p.value as string) ?? ""}
          onChange={(e) => p.onChange(e.target.value)}>
          <For each={(p.field as any).options}>{([v, l]: [string, string]) =>
            <option value={v}>{l}</option>
          }</For>
        </select>
      </Show>

      {/* multiSelect (checkboxes) */}
      <Show when={p.field.type === "multiSelect"}>
        <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
          <For each={(p.field as any).options}>{([el, label]: [string, string]) => (
            <label style={{ display: "inline-flex", "align-items": "center", gap: "2px", "font-size": "12px", cursor: "pointer" }}>
              <input type="checkbox"
                checked={((p.value as string[]) ?? []).includes(el)}
                onChange={(e) => {
                  const current = (p.value as string[]) ?? [];
                  p.onChange(e.target.checked ? [...current, el] : current.filter((x) => x !== el));
                }} />
              {label}
            </label>
          )}</For>
        </div>
      </Show>

      {/* idArray (comma-separated text) */}
      <Show when={p.field.type === "idArray"}>
        <input class="input-field" type="text" placeholder={(p.field as any).placeholder}
          value={((p.value as number[]) ?? []).join(",")}
          onChange={(e) => p.onChange(e.target.value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)))} />
      </Show>

      {/* tagSelect (CARD_TAG_LABELS) */}
      <Show when={p.field.type === "tagSelect"}>
        <select class="input-field" value={(p.value as string) ?? ""}
          onChange={(e) => p.onChange(e.target.value)}>
          <For each={Object.entries(CARD_TAG_LABELS)}>{([v, l]) => <option value={v}>{l}</option>}</For>
        </select>
      </Show>
    </>
  );
}

// ============================================================
// 条件编辑行（通用）
// ============================================================

function ConditionRow(p: {
  condition: EventCondition;
  index: number;
  onUpdate: (i: number, c: EventCondition) => void;
  onRemove: (i: number) => void;
}) {
  const condType = () => p.condition.condition.type;
  const desc = () => CONDITION_DESCRIPTORS[condType()];

  const updateType = (newType: EventConditionType["type"]) => {
    p.onUpdate(p.index, { ...p.condition, condition: CONDITION_DESCRIPTORS[newType].default });
  };

  const updateField = (key: string, value: unknown) => {
    const newCond = { ...p.condition.condition, [key]: value } as EventConditionType;
    p.onUpdate(p.index, { ...p.condition, condition: newCond });
  };

  return (
    <div class="ee-modifier-row">
      <select class="input-field" value={condType()} onChange={(e) => updateType(e.target.value as EventConditionType["type"])}>
        <For each={Object.entries(CONDITION_DESCRIPTORS)}>{([t, d]) => <option value={t}>{d.label}</option>}</For>
      </select>

      <For each={desc()?.fields}>{(field) => (
        <FieldRenderer
          field={field}
          value={(p.condition.condition as any)[field.key]}
          onChange={(v) => updateField(field.key, v)} />
      )}</For>

      <span class="ee-weight-label">权重</span>
      <NumberInput value={p.condition.weight} min={1} max={100}
        onChange={(v) => p.onUpdate(p.index, { ...p.condition, weight: v })} />

      <button class="editor-btn-icon editor-btn-icon-danger" onClick={() => p.onRemove(p.index)}>✕</button>
    </div>
  );
}

// ============================================================
// 效果编辑行（通用）
// ============================================================

function EffectRow(p: {
  effect: EventEffectType;
  index: number;
  onUpdate: (i: number, e: EventEffectType) => void;
  onRemove: (i: number) => void;
}) {
  const effType = () => p.effect.type;
  const desc = () => EFFECT_DESCRIPTORS[effType()];

  const updateType = (newType: EventEffectType["type"]) => {
    p.onUpdate(p.index, EFFECT_DESCRIPTORS[newType].default);
  };

  const updateField = (key: string, value: unknown) => {
    p.onUpdate(p.index, { ...p.effect, [key]: value } as EventEffectType);
  };

  return (
    <div class="ee-modifier-row">
      <select class="input-field" value={effType()} onChange={(e) => updateType(e.target.value as EventEffectType["type"])}>
        <For each={Object.entries(EFFECT_DESCRIPTORS)}>{([t, d]) => <option value={t}>{d.label}</option>}</For>
      </select>

      <For each={desc()?.fields}>{(field) => (
        <FieldRenderer
          field={field}
          value={(p.effect as any)[field.key]}
          onChange={(v) => updateField(field.key, v)} />
      )}</For>

      <button class="editor-btn-icon editor-btn-icon-danger" onClick={() => p.onRemove(p.index)}>✕</button>
    </div>
  );
}

// ============================================================
// 单个事件编辑卡片
// ============================================================

function EventCard(p: {
  event: EventDefinition;
  onUpdate: (e: EventDefinition) => void;
  onTest?: () => void;
  onDelete?: () => void;
}) {
  const { add: addCondition, update: updateCondition, remove: removeCondition } = useEditableList(
    () => p.event.conditions,
    (conditions) => p.onUpdate({ ...p.event, conditions }),
    () => ({ condition: { type: "floorAtLeast" as const, floor: 1 }, weight: 1 }),
  );
  const { add: addEffect, update: updateEffect, remove: removeEffect } = useEditableList(
    () => p.event.effects,
    (effects) => p.onUpdate({ ...p.event, effects }),
    () => ({ type: "addCurrency" as const, amount: 5 }),
  );

  return (
    <div class="ee-card" style={{ "margin-bottom": "16px" }}>
      {/* 基本信息 */}
      <div class="ee-card-top">
        <Show when={p.event.imageUrl} fallback={
          <div class="card-item ee-avatar" style={{ width: "120px", height: "80px", background: "#1e293b", "border-radius": "8px", display: "flex", "align-items": "center", "justify-content": "center", "font-size": "2rem" }}>
            📜
          </div>
        }>
          <img src={p.event.imageUrl} alt={p.event.name} style={{ width: "120px", height: "80px", "object-fit": "cover", "object-position": "top center", "border-radius": "8px" }} />
        </Show>
        <div class="ee-card-info">
          <div class="ee-name-row">
            <input class="input-field" type="text" placeholder="事件名称"
              value={p.event.name}
              onChange={(e) => p.onUpdate({ ...p.event, name: e.target.value })} />
            <Show when={p.onTest}>
              <button class="ee-btn-test" onClick={p.onTest}>▶ 测试</button>
            </Show>
            <Show when={p.onDelete}>
              <button class="ee-btn-test ee-btn-delete-sm" onClick={p.onDelete}>删除</button>
            </Show>
          </div>
          <div class="ee-fields">
            <label class="ee-field" style={{ flex: 1 }}>
              <span>图片URL</span>
              <input class="input-field" type="text" placeholder="https://..."
                value={p.event.imageUrl}
                onChange={(e) => p.onUpdate({ ...p.event, imageUrl: e.target.value })} />
            </label>
            <label class="ee-field" style={{ "min-width": "60px" }}>
              <span>ID</span>
              <NumberInput value={p.event.id} min={1} max={9999}
                onChange={(v) => p.onUpdate({ ...p.event, id: v })} />
            </label>
          </div>
        </div>
      </div>

      {/* 剧情文本 */}
      <div class="ee-modifiers">
        <div class="ee-modifiers-header">
          <span>剧情文字</span>
        </div>
        <textarea class="input-field" rows={3} style={{ width: "100%", resize: "vertical" }}
          placeholder="输入剧情文字模板..."
          value={p.event.storyTemplate}
          onChange={(e) => p.onUpdate({ ...p.event, storyTemplate: e.target.value })} />
      </div>

      {/* 触发条件 */}
      <div class="ee-modifiers">
        <div class="ee-modifiers-header">
          <span>触发条件</span>
          <Show when={p.event.conditions.length > 1}>
            <label class="ee-field" style={{ display: "inline-flex", "align-items": "center", gap: "4px", "margin-left": "12px" }}>
              <span style={{ "font-size": "12px", color: "#94a3b8" }}>匹配模式</span>
              <select class="input-field" style={{ width: "auto", padding: "2px 6px" }}
                value={p.event.conditionMode ?? "or"}
                onChange={(e) => p.onUpdate({ ...p.event, conditionMode: e.target.value as "and" | "or" })}>
                <option value="or">任一满足（OR）</option>
                <option value="and">全部满足（AND）</option>
              </select>
            </label>
          </Show>
          <button class="ee-btn-add" onClick={addCondition}>+ 添加条件</button>
        </div>
        <For each={p.event.conditions}>{(cond, i) => (
          <ConditionRow condition={cond} index={i()} onUpdate={updateCondition} onRemove={removeCondition} />
        )}</For>
        <Show when={p.event.conditions.length === 0}>
          <p class="pve-debug-hint">无条件 = 始终可触发</p>
        </Show>
        <Show when={p.event.conditions.length > 1}>
          <p class="pve-debug-hint">
            {(p.event.conditionMode ?? "or") === "or"
              ? "当前：任一条件满足即触发（OR），权重越高越优先"
              : "当前：所有条件必须满足才触发（AND）"}
          </p>
        </Show>
      </div>

      {/* 事件效果 */}
      <div class="ee-modifiers">
        <div class="ee-modifiers-header">
          <span>事件效果</span>
          <button class="ee-btn-add" onClick={addEffect}>+ 添加效果</button>
        </div>
        <For each={p.event.effects}>{(eff, i) => (
          <EffectRow effect={eff} index={i()} onUpdate={updateEffect} onRemove={removeEffect} />
        )}</For>
      </div>
    </div>
  );
}

// ============================================================
// 子编辑器模式（从 LevelEditor 调用）
// ============================================================

function EventSubEditor(p: {
  event: EventDefinition;
  label: string;
  onSave: (e: EventDefinition) => void;
  onClose: () => void;
}) {
  const [event, setEvent] = createSignal(structuredClone(p.event));

  return (
    <OverlayPanel title={`📜 编辑事件 [${p.label}]`} onClose={p.onClose} maxWidth="800px" zIndex={1100}
      titleActions={
        <button class="editor-btn editor-btn-save" onClick={() => { p.onSave(event()); p.onClose(); }}>保存</button>
      }
    >
      <EventCard event={event()} onUpdate={setEvent} />
    </OverlayPanel>
  );
}

// ============================================================
// 独立编辑器模式（编辑全局事件池）
// ============================================================

export type EventEditorProps =
  | { mode?: "standalone"; onSave: () => void; onClose: () => void; onTestEvent?: (event: EventDefinition) => void }
  | { mode: "sub"; subEvent: EventDefinition; subLabel: string; onSubSave: (event: EventDefinition) => void; onClose: () => void };

export function EventEditor(p: EventEditorProps) {
  // 子编辑器模式
  if (p.mode === "sub") {
    return <EventSubEditor event={p.subEvent} label={p.subLabel} onSave={p.onSubSave} onClose={p.onClose} />;
  }

  // 独立模式：编辑全局事件列表
  const initialEvents = configStore.events();
  const [events, setEventsLocal] = createSignal<EventDefinition[]>(
    initialEvents.length > 0 ? structuredClone(initialEvents) : structuredClone(DEFAULT_EVENTS)
  );

  const { add: addEvent, update: updateEvent, remove: removeEvent } = useEditableList(
    events, setEventsLocal,
    () => {
      const maxId = events().reduce((max, e) => Math.max(max, e.id), 0);
      return {
        id: maxId + 1,
        name: "新事件",
        imageUrl: "",
        storyTemplate: "",
        conditions: [],
        effects: [{ type: "addCurrency" as const, amount: 5 }],
      };
    },
  );

  const doSave = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    configStore.setEvents(events());
    p.onSave();
    p.onClose();
  };

  return (
    <OverlayPanel title="📜 事件编辑" onClose={p.onClose} maxWidth="900px"
      titleActions={
        <EditorToolbar
          filename="event-config.json"
          getData={events}
          onImport={(d: EventDefinition[]) => setEventsLocal(d)}
          onReset={() => { setEventsLocal([...DEFAULT_EVENTS]); configStore.setEvents([...DEFAULT_EVENTS]); }}
        >
          <button class="editor-btn editor-btn-save" onClick={doSave}>保存</button>
        </EditorToolbar>
      }
    >
      <>
        <p class="le-hint">定义可在事件节点触发的事件。默认任一条件满足即可触发（OR），权重越高越容易被选中。多条件时可切换为"全部满足"（AND）模式。</p>
        <For each={events()}>
          {(evt, i) => (
            <EventCard event={evt} onUpdate={(e) => updateEvent(i(), e)}
              onTest={p.onTestEvent ? () => p.onTestEvent!(evt) : undefined}
              onDelete={() => removeEvent(i())} />
          )}
        </For>
        <button class="ee-btn-add-enemy" onClick={addEvent}>+ 添加新事件</button>
      </>
    </OverlayPanel>
  );
}
