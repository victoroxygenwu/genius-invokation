import { For, Show, createSignal, createMemo } from "solid-js";
import getData from "@gi-tcg/data";
import { CURRENT_VERSION } from "@gi-tcg/core";
import {
  getCardName, DEFAULT_EVENTS,
  type EventDefinition, type EventCondition, type EventConditionType,
  type EventEffectType,
} from "@gi-tcg/roguelike";
import { getEvents, setEvents, exportJson, importJson } from "./configStore";
import { OverlayPanel } from "./OverlayPanel";
import { SafeImage } from "./SafeImage";
import { NumberInput } from "./NumberInput";

const data = getData(CURRENT_VERSION);

// ============================================================
// 条件类型定义
// ============================================================

const CONDITION_TYPE_LABELS: Record<EventConditionType["type"], string> = {
  hasCard: "拥有卡牌",
  hasCharacterTag: "角色标签",
  hasCharacter: "拥有角色",
  defeatedEnemy: "击败敌人",
  floorAtLeast: "到达楼层",
  currencyAtLeast: "费用达到",
  deckSizeAtLeast: "卡组数量",
  teamSizeAtLeast: "队伍人数",
  anyEventCompleted: "完成任意事件",
  noEventCompleted: "未完成事件",
};

// ============================================================
// 效果类型定义
// ============================================================

const EFFECT_TYPE_LABELS: Record<EventEffectType["type"], string> = {
  addCurrency: "增加费用",
  removeCurrency: "减少费用",
  addCard: "添加卡牌",
  removeCard: "移除卡牌",
  addRandomCards: "随机卡牌",
  modifyCharacterMaxHp: "修改角色HP上限",
  healCharacter: "治疗角色",
  addCharacter: "添加角色",
  modifyNextEnemyHp: "修改下一敌人HP",
  skipNextNode: "跳过下一节点",
};

// ============================================================
// 条件编辑行
// ============================================================

function ConditionRow(p: {
  condition: EventCondition;
  index: number;
  onUpdate: (i: number, c: EventCondition) => void;
  onRemove: (i: number) => void;
}) {
  const condType = () => p.condition.condition.type;
  const updateType = (newType: EventConditionType["type"]) => {
    // 切换类型时创建默认值
    let newCond: EventConditionType;
    switch (newType) {
      case "hasCard":
        newCond = { type: "hasCard", cardId: 332001, minCount: 1 };
        break;
      case "hasCharacterTag":
        newCond = { type: "hasCharacterTag", tag: "pyro", minCount: 1 };
        break;
      case "hasCharacter":
        newCond = { type: "hasCharacter", characterId: 1501 };
        break;
      case "defeatedEnemy":
        newCond = { type: "defeatedEnemy", enemyId: 2001 };
        break;
      case "floorAtLeast":
        newCond = { type: "floorAtLeast", floor: 1 };
        break;
      case "currencyAtLeast":
        newCond = { type: "currencyAtLeast", amount: 10 };
        break;
      case "deckSizeAtLeast":
        newCond = { type: "deckSizeAtLeast", count: 10 };
        break;
      case "teamSizeAtLeast":
        newCond = { type: "teamSizeAtLeast", count: 2 };
        break;
      case "anyEventCompleted":
        newCond = { type: "anyEventCompleted", eventIds: [] };
        break;
      case "noEventCompleted":
        newCond = { type: "noEventCompleted", eventIds: [] };
        break;
    }
    p.onUpdate(p.index, { ...p.condition, condition: newCond });
  };

  const updateConditionField = (field: string, value: any) => {
    const newCond = { ...p.condition.condition, [field]: value } as EventConditionType;
    p.onUpdate(p.index, { ...p.condition, condition: newCond });
  };

  return (
    <div class="ee-modifier-row">
      <select class="input-field" value={condType()} onChange={(e) => updateType(e.target.value as EventConditionType["type"])}>
        <For each={Object.entries(CONDITION_TYPE_LABELS)}>{([t, l]) => <option value={t}>{l}</option>}</For>
      </select>

      {/* hasCard: cardId + minCount */}
      <Show when={condType() === "hasCard"}>
        <input class="input-field" type="number" placeholder="卡牌ID"
          value={(p.condition.condition as any).cardId ?? 332001}
          onChange={(e) => updateConditionField("cardId", parseInt(e.target.value) || 332001)} />
        <NumberInput value={(p.condition.condition as any).minCount ?? 1} min={1} max={10}
          onChange={(v) => updateConditionField("minCount", v)} />
      </Show>

      {/* hasCharacterTag: tag + minCount */}
      <Show when={condType() === "hasCharacterTag"}>
        <select class="input-field" value={(p.condition.condition as any).tag ?? "pyro"}
          onChange={(e) => updateConditionField("tag", e.target.value)}>
          <option value="pyro">火</option>
          <option value="hydro">水</option>
          <option value="anemo">风</option>
          <option value="electro">雷</option>
          <option value="dendro">草</option>
          <option value="cryo">冰</option>
          <option value="geo">岩</option>
          <option value="mondstadt">蒙德</option>
          <option value="liyue">璃月</option>
          <option value="inazuma">稻妻</option>
          <option value="sumeru">须弥</option>
          <option value="fontaine">枫丹</option>
          <option value="natlan">纳塔</option>
          <option value="nodkrai">诺德卡莱</option>
          <option value="sword">单手剑</option>
          <option value="claymore">双手剑</option>
          <option value="pole">长柄武器</option>
          <option value="catalyst">法器</option>
          <option value="bow">弓</option>
        </select>
        <NumberInput value={(p.condition.condition as any).minCount ?? 1} min={1} max={4}
          onChange={(v) => updateConditionField("minCount", v)} />
      </Show>

      {/* hasCharacter: characterId */}
      <Show when={condType() === "hasCharacter"}>
        <input class="input-field" type="number" placeholder="角色ID"
          value={(p.condition.condition as any).characterId ?? 1501}
          onChange={(e) => updateConditionField("characterId", parseInt(e.target.value) || 1501)} />
      </Show>

      {/* defeatedEnemy: enemyId */}
      <Show when={condType() === "defeatedEnemy"}>
        <input class="input-field" type="number" placeholder="敌人ID"
          value={(p.condition.condition as any).enemyId ?? 2001}
          onChange={(e) => updateConditionField("enemyId", parseInt(e.target.value) || 2001)} />
      </Show>

      {/* floorAtLeast: floor */}
      <Show when={condType() === "floorAtLeast"}>
        <NumberInput value={(p.condition.condition as any).floor ?? 1} min={1} max={10}
          onChange={(v) => updateConditionField("floor", v)} />
      </Show>

      {/* currencyAtLeast: amount */}
      <Show when={condType() === "currencyAtLeast"}>
        <NumberInput value={(p.condition.condition as any).amount ?? 10} min={1} max={999}
          onChange={(v) => updateConditionField("amount", v)} />
      </Show>

      {/* deckSizeAtLeast: count */}
      <Show when={condType() === "deckSizeAtLeast"}>
        <NumberInput value={(p.condition.condition as any).count ?? 10} min={1} max={100}
          onChange={(v) => updateConditionField("count", v)} />
      </Show>

      {/* teamSizeAtLeast: count */}
      <Show when={condType() === "teamSizeAtLeast"}>
        <NumberInput value={(p.condition.condition as any).count ?? 2} min={1} max={4}
          onChange={(v) => updateConditionField("count", v)} />
      </Show>

      {/* anyEventCompleted / noEventCompleted: eventIds (comma-separated) */}
      <Show when={condType() === "anyEventCompleted" || condType() === "noEventCompleted"}>
        <input class="input-field" type="text" placeholder="事件ID（逗号分隔）"
          value={((p.condition.condition as any).eventIds ?? []).join(",")}
          onChange={(e) => updateConditionField("eventIds", e.target.value.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n)))} />
      </Show>

      {/* 权重 */}
      <label class="ee-field" style={{ "white-space": "nowrap" }}>
        <span>权重</span>
        <NumberInput value={p.condition.weight} min={1} max={100}
          onChange={(v) => p.onUpdate(p.index, { ...p.condition, weight: v })} />
      </label>

      <button class="editor-btn-icon editor-btn-icon-danger" onClick={() => p.onRemove(p.index)}>✕</button>
    </div>
  );
}

// ============================================================
// 效果编辑行
// ============================================================

function EffectRow(p: {
  effect: EventEffectType;
  index: number;
  onUpdate: (i: number, e: EventEffectType) => void;
  onRemove: (i: number) => void;
}) {
  const effType = () => p.effect.type;

  const updateType = (newType: EventEffectType["type"]) => {
    let newEff: EventEffectType;
    switch (newType) {
      case "addCurrency": newEff = { type: "addCurrency", amount: 5 }; break;
      case "removeCurrency": newEff = { type: "removeCurrency", amount: 5 }; break;
      case "addCard": newEff = { type: "addCard", cardId: 332001, count: 1 }; break;
      case "removeCard": newEff = { type: "removeCard", cardId: 332001, count: 1 }; break;
      case "addRandomCards": newEff = { type: "addRandomCards", count: 2 }; break;
      case "modifyCharacterMaxHp": newEff = { type: "modifyCharacterMaxHp", amount: 3 }; break;
      case "healCharacter": newEff = { type: "healCharacter", amount: 5 }; break;
      case "addCharacter": newEff = { type: "addCharacter", characterId: 1501 }; break;
      case "modifyNextEnemyHp": newEff = { type: "modifyNextEnemyHp", amount: -5 }; break;
      case "skipNextNode": newEff = { type: "skipNextNode" }; break;
    }
    p.onUpdate(p.index, newEff);
  };

  const updateField = (field: string, value: any) => {
    p.onUpdate(p.index, { ...p.effect, [field]: value } as EventEffectType);
  };

  return (
    <div class="ee-modifier-row">
      <select class="input-field" value={effType()} onChange={(e) => updateType(e.target.value as EventEffectType["type"])}>
        <For each={Object.entries(EFFECT_TYPE_LABELS)}>{([t, l]) => <option value={t}>{l}</option>}</For>
      </select>

      {/* addCurrency / removeCurrency: amount */}
      <Show when={effType() === "addCurrency" || effType() === "removeCurrency"}>
        <NumberInput value={(p.effect as any).amount ?? 5} min={1} max={999}
          onChange={(v) => updateField("amount", v)} />
      </Show>

      {/* addCard / removeCard: cardId + count */}
      <Show when={effType() === "addCard" || effType() === "removeCard"}>
        <input class="input-field" type="number" placeholder="卡牌ID"
          value={(p.effect as any).cardId ?? 332001}
          onChange={(e) => updateField("cardId", parseInt(e.target.value) || 332001)} />
        <NumberInput value={(p.effect as any).count ?? 1} min={1} max={10}
          onChange={(v) => updateField("count", v)} />
      </Show>

      {/* addRandomCards: count */}
      <Show when={effType() === "addRandomCards"}>
        <NumberInput value={(p.effect as any).count ?? 2} min={1} max={10}
          onChange={(v) => updateField("count", v)} />
      </Show>

      {/* modifyCharacterMaxHp / healCharacter: characterId (optional) + amount */}
      <Show when={effType() === "modifyCharacterMaxHp" || effType() === "healCharacter"}>
        <input class="input-field" type="number" placeholder="角色ID（空=全部）"
          value={(p.effect as any).characterId ?? ""}
          onChange={(e) => updateField("characterId", e.target.value ? parseInt(e.target.value) : undefined)} />
        <NumberInput value={(p.effect as any).amount ?? 3} min={-99} max={99}
          onChange={(v) => updateField("amount", v)} />
      </Show>

      {/* addCharacter: characterId */}
      <Show when={effType() === "addCharacter"}>
        <input class="input-field" type="number" placeholder="角色ID"
          value={(p.effect as any).characterId ?? 1501}
          onChange={(e) => updateField("characterId", parseInt(e.target.value) || 1501)} />
      </Show>

      {/* modifyNextEnemyHp: amount */}
      <Show when={effType() === "modifyNextEnemyHp"}>
        <NumberInput value={(p.effect as any).amount ?? -5} min={-99} max={99}
          onChange={(v) => updateField("amount", v)} />
      </Show>

      {/* skipNextNode: no params */}

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
}) {
  const addCondition = () => {
    const newCond: EventCondition = {
      condition: { type: "floorAtLeast", floor: 1 },
      weight: 1,
    };
    p.onUpdate({ ...p.event, conditions: [...p.event.conditions, newCond] });
  };
  const updateCondition = (i: number, c: EventCondition) => {
    const newConds = [...p.event.conditions];
    newConds[i] = c;
    p.onUpdate({ ...p.event, conditions: newConds });
  };
  const removeCondition = (i: number) => {
    p.onUpdate({ ...p.event, conditions: p.event.conditions.filter((_, idx) => idx !== i) });
  };

  const addEffect = () => {
    const newEff: EventEffectType = { type: "addCurrency", amount: 5 };
    p.onUpdate({ ...p.event, effects: [...p.event.effects, newEff] });
  };
  const updateEffect = (i: number, e: EventEffectType) => {
    const newEffs = [...p.event.effects];
    newEffs[i] = e;
    p.onUpdate({ ...p.event, effects: newEffs });
  };
  const removeEffect = (i: number) => {
    p.onUpdate({ ...p.event, effects: p.event.effects.filter((_, idx) => idx !== i) });
  };

  return (
    <div class="ee-card" style={{ "margin-bottom": "16px" }}>
      {/* 基本信息 */}
      <div class="ee-card-top">
        <Show when={p.event.imageUrl} fallback={
          <div class="card-item ee-avatar" style={{ width: "120px", height: "80px", background: "#1e293b", "border-radius": "8px", display: "flex", "align-items": "center", "justify-content": "center", "font-size": "2rem" }}>
            {p.event.eventTag === "positive" ? "✨" : "💀"}
          </div>
        }>
          <img src={p.event.imageUrl} alt={p.event.name} style={{ width: "120px", height: "80px", "object-fit": "cover", "border-radius": "8px" }} />
        </Show>
        <div class="ee-card-info">
          <div class="ee-name-row">
            <input class="input-field" type="text" placeholder="事件名称"
              value={p.event.name}
              onChange={(e) => p.onUpdate({ ...p.event, name: e.target.value })} />
            <select class="input-field" value={p.event.eventTag}
              onChange={(e) => p.onUpdate({ ...p.event, eventTag: e.target.value as "positive" | "negative" })}>
              <option value="positive">✨ 正面</option>
              <option value="negative">💀 负面</option>
            </select>
          </div>
          <div class="ee-fields">
            <label class="ee-field" style={{ flex: 1 }}>
              <span>图片URL</span>
              <input class="input-field" type="text" placeholder="https://..."
                value={p.event.imageUrl}
                onChange={(e) => p.onUpdate({ ...p.event, imageUrl: e.target.value })} />
            </label>
            <label class="ee-field">
              <span>事件ID</span>
              <NumberInput value={p.event.id} min={1} max={99999}
                onChange={(v) => p.onUpdate({ ...p.event, id: v })} />
            </label>
          </div>
        </div>
      </div>

      {/* 剧情文本 */}
      <div class="ee-modifiers">
        <div class="ee-modifiers-header">
          <span>剧情文字（支持 {"{{playerNames}}"}, {"{{deckSize}}"}, {"{{currency}}"}, {"{{floor}}"}, {"{{teamSize}}"}, {"{{cardName:ID}}"}, {"{{charName:ID}}"}）</span>
        </div>
        <textarea class="input-field" rows={3} style={{ width: "100%", resize: "vertical" }}
          placeholder="输入剧情文字模板..."
          value={p.event.storyTemplate}
          onChange={(e) => p.onUpdate({ ...p.event, storyTemplate: e.target.value })} />
      </div>

      {/* 触发条件 */}
      <div class="ee-modifiers">
        <div class="ee-modifiers-header">
          <span>触发条件（全部满足时触发，权重用于多事件竞争）</span>
          <button class="ee-btn-add" onClick={addCondition}>+ 添加条件</button>
        </div>
        <For each={p.event.conditions}>{(cond, i) => (
          <ConditionRow condition={cond} index={i()} onUpdate={updateCondition} onRemove={removeCondition} />
        )}</For>
        <Show when={p.event.conditions.length === 0}>
          <p class="pve-debug-hint">无条件 = 始终可触发（权重默认为 1）</p>
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
  | { mode?: "standalone"; onSave: () => void; onClose: () => void }
  | { mode: "sub"; subEvent: EventDefinition; subLabel: string; onSubSave: (event: EventDefinition) => void; onClose: () => void };

export function EventEditor(p: EventEditorProps) {
  // 子编辑器模式
  if (p.mode === "sub") {
    return <EventSubEditor event={p.subEvent} label={p.subLabel} onSave={p.onSubSave} onClose={p.onClose} />;
  }

  // 独立模式：编辑全局事件列表
  const initialEvents = getEvents();
  const [events, setEventsLocal] = createSignal<EventDefinition[]>(
    initialEvents.length > 0 ? structuredClone(initialEvents) : structuredClone(DEFAULT_EVENTS)
  );

  const updateEvent = (i: number, e: EventDefinition) => {
    const list = [...events()];
    list[i] = e;
    setEventsLocal(list);
  };
  const removeEvent = (i: number) => {
    setEventsLocal(events().filter((_, idx) => idx !== i));
  };
  const addEvent = () => {
    const maxId = events().reduce((max, e) => Math.max(max, e.id), 0);
    const newEvent: EventDefinition = {
      id: maxId + 1,
      name: "新事件",
      eventTag: "positive",
      imageUrl: "",
      storyTemplate: "",
      conditions: [],
      effects: [{ type: "addCurrency", amount: 5 }],
    };
    setEventsLocal([...events(), newEvent]);
  };

  const doSave = () => {
    setEvents(events());
    p.onSave();
    p.onClose();
  };

  return (
    <OverlayPanel title="📜 事件编辑" onClose={p.onClose} maxWidth="900px"
      titleActions={<>
        <button class="editor-btn" onClick={async () => {
          const d = await importJson<EventDefinition[]>();
          if (d) setEventsLocal(d);
        }}>导入</button>
        <button class="editor-btn" onClick={() => exportJson(events(), "event-config.json")}>导出</button>
        <button class="editor-btn editor-btn-save" onClick={doSave}>保存</button>
      </>}
    >
      <>
        <p class="le-hint">定义可在事件节点触发的事件。条件全部满足时事件才会进入候选池，权重越高越容易被选中。</p>
        <For each={events()}>
          {(evt, i) => (
            <div style={{ position: "relative" }}>
              <EventCard event={evt} onUpdate={(e) => updateEvent(i(), e)} />
              <button class="ee-btn-delete" style={{ position: "absolute", top: "8px", right: "8px" }}
                onClick={() => removeEvent(i())}>删除事件</button>
            </div>
          )}
        </For>
        <button class="ee-btn-add-enemy" onClick={addEvent}>+ 添加新事件</button>
      </>
    </OverlayPanel>
  );
}
