import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CircleDollarSign,
  ChevronRight,
  Search as SearchIcon,
  SearchX,
  X,
} from "lucide-react";
import styles from "./ModelSelector.module.css";
import { type Model } from "./modelRegistry";
import { useModelRegistry } from "./useModelRegistry";
import { useAppStore } from "../../stores/useAppStore";

export { MODELS, is1mContextModel, get1mFallback } from "./modelRegistry";

interface ModelSelectorProps {
  selected: string;
  selectedProvider?: string;
  onSelect: (model: string, providerId?: string) => void;
  onClose: () => void;
}

function isSelectedModel(
  model: Model,
  selected: string,
  selectedProvider: string,
): boolean {
  return (
    model.id === selected &&
    (model.providerId ?? "anthropic") === selectedProvider
  );
}

interface Section {
  /** Unique section key used for header rendering — the group label. */
  key: string;
  /** Human-readable header. */
  label: string;
  /** Models always visible in this section. */
  primary: Model[];
  /** Models hidden behind the section-level "More" disclosure
   *  (Claude Code's older Anthropic models). */
  legacy: Model[];
}

/**
 * Group `models` by their section. Sections appear in the iteration
 * order of `models` (so the Claude Code curated list always renders
 * first).
 */
function buildSections(models: readonly Model[]): Section[] {
  const sections = new Map<string, Section>();
  for (const model of models) {
    const key = model.group;
    let section = sections.get(key);
    if (!section) {
      section = { key, label: key, primary: [], legacy: [] };
      sections.set(key, section);
    }
    if (model.legacy) section.legacy.push(model);
    else section.primary.push(model);
  }
  return Array.from(sections.values());
}

export function ModelSelector({
  selected,
  selectedProvider = "anthropic",
  onSelect,
  onClose,
}: ModelSelectorProps) {
  const { t } = useTranslation("chat");
  const disable1mContext = useAppStore((s) => s.disable1mContext);
  // `useModelRegistry` applies every cross-cutting visibility gate
  // (feature flags + OAuth Pi-anthropic filter) so this picker never
  // surfaces a row the Rust resolver would refuse mid-send.
  const registry = useModelRegistry();
  const visibleModels = useMemo(
    () =>
      registry.filter((m) => {
        if (disable1mContext && m.contextWindowTokens >= 1_000_000) return false;
        return true;
      }),
    [disable1mContext, registry],
  );

  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const filteredBySearch = useMemo(() => {
    if (!searching) return visibleModels;
    return visibleModels.filter((m) =>
      `${m.id} ${m.label} ${m.group}`.toLowerCase().includes(trimmedQuery),
    );
  }, [searching, trimmedQuery, visibleModels]);

  // Always keep the currently selected option visible even when a
  // filter would hide it — otherwise typing a non-matching query makes
  // the in-effect choice disappear, which is disorienting.
  const selectedEntry = useMemo(
    () =>
      visibleModels.find((m) => isSelectedModel(m, selected, selectedProvider)),
    [visibleModels, selected, selectedProvider],
  );
  const filteredHasSelected = filteredBySearch.some((m) =>
    isSelectedModel(m, selected, selectedProvider),
  );
  const finalModels =
    !filteredHasSelected && selectedEntry
      ? [selectedEntry, ...filteredBySearch]
      : filteredBySearch;

  const sections = useMemo(() => buildSections(finalModels), [finalModels]);

  const selectedIsLegacy = registry.some(
    (m) => isSelectedModel(m, selected, selectedProvider) && m.legacy,
  );

  // Section-level disclosure state. Keys are the section's `key`.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // On open, if the in-effect selection lives behind a disclosure,
  // pre-expand its container so the row is visible.
  useEffect(() => {
    if (!selectedIsLegacy || !selectedEntry) return;
    const key = selectedEntry.group;
    setExpanded((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, [selectedIsLegacy, selectedEntry]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Tiny delay so the focus survives the click that opened the popover.
    const handle = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, []);

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function rowsForSection(section: Section): React.ReactElement[] {
    // Primary rows + a single "More" disclosure for legacy.
    const rows: React.ReactElement[] = [];
    for (const model of section.primary) {
      rows.push(
        <ModelRow
          key={model.providerQualifiedId ?? model.id}
          model={model}
          selected={isSelectedModel(model, selected, selectedProvider)}
          onSelect={onSelect}
          showProviderBadge={model.providerLabel !== section.key}
        />,
      );
    }
    if (section.legacy.length > 0 && !searching) {
      const isExpanded = expanded.has(section.key);
      rows.push(
        <button
          key={`${section.key}__more`}
          type="button"
          className={`${styles.item} ${styles.moreToggle}`}
          aria-expanded={isExpanded}
          onClick={() => toggleExpanded(section.key)}
        >
          {t("more_models")}
          <ChevronRight
            size={14}
            className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""}`}
          />
        </button>,
      );
      if (isExpanded) {
        for (const model of section.legacy) {
          rows.push(
            <ModelRow
              key={model.providerQualifiedId ?? model.id}
              model={model}
              selected={isSelectedModel(model, selected, selectedProvider)}
              onSelect={onSelect}
              showProviderBadge={Boolean(model.providerLabel)}
            />,
          );
        }
      }
    }
    if (section.legacy.length > 0 && searching) {
      for (const model of section.legacy) {
        rows.push(
          <ModelRow
            key={model.providerQualifiedId ?? model.id}
            model={model}
            selected={isSelectedModel(model, selected, selectedProvider)}
            onSelect={onSelect}
            showProviderBadge={Boolean(model.providerLabel)}
          />,
        );
      }
    }
    return rows;
  }

  const searchPlaceholder = t("model_picker_search_placeholder", {
    defaultValue: "Search models…",
  });

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.dropdown}>
        <div className={styles.searchBar}>
          <SearchIcon size={14} className={styles.searchIcon} aria-hidden />
          <input
            ref={searchRef}
            type="search"
            className={styles.searchInput}
            value={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className={styles.searchClearBtn}
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              aria-label={t("model_picker_clear_search", {
                defaultValue: "Clear search",
              })}
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
        <div className={styles.scrollArea}>
          {sections.length === 0 ? (
            <div className={styles.emptyState}>
              <SearchX size={18} className={styles.emptyStateIcon} aria-hidden />
              <span>
                {t("model_picker_no_results", {
                  defaultValue: "No models match",
                })}
              </span>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.key} className={styles.section}>
                <div className={styles.groupHeader}>
                  <span className={styles.groupLabel}>{section.label}</span>
                </div>
                {rowsForSection(section)}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function ModelRow({
  model,
  selected,
  onSelect,
  showProviderBadge,
}: {
  model: Model;
  selected: boolean;
  onSelect: (id: string, providerId?: string) => void;
  showProviderBadge?: boolean;
}) {
  const { t } = useTranslation("chat");
  const shouldShowProviderBadge = Boolean(showProviderBadge && model.providerLabel);
  return (
    <button
      type="button"
      className={`${styles.item} ${selected ? styles.itemSelected : ""}`}
      onClick={() => onSelect(model.id, model.providerId)}
    >
      <span className={styles.dot} />
      <span className={styles.modelLabel} title={model.label}>{model.label}</span>
      {shouldShowProviderBadge && (
        <span className={styles.providerBadge}>{model.providerLabel}</span>
      )}
      {model.extraUsage && (
        <span
          className={styles.extraUsage}
          title={t("mcp_extra_usage_tip")}
        >
          <CircleDollarSign size={14} />
        </span>
      )}
      {selected && <span className={styles.check}>✓</span>}
    </button>
  );
}
