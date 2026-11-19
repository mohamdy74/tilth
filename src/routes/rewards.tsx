import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Lock,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Target,
  Trash2,
  Trophy,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { usePrefs } from "@/components/app/preferences";
import { PageHeader } from "@/components/app/PageHeader";
import { ACHIEVEMENT_ICONS } from "@/components/app/achievementIcons";
import { startOfWeek } from "@/lib/dates";
import { formatDate, formatNumber } from "@/lib/i18n";
import { ACHIEVEMENTS, type Achievement, type AchievementState } from "@/lib/achievements";
import { dailyChallenges, weeklyChallenges, type ChallengeDef } from "@/lib/challenges";
import { totalsFromLedger, xpAwardedOnDay, xpSeriesByDay } from "@/lib/rewards";
import { purchaseHistory, SHOP_CATEGORIES, isShopCategory } from "@/lib/shop";
import { THEMES, isThemeUnlocked, type ThemeUnlockState } from "@/lib/themes";
import { DAILY_XP_CAP, THEME_UNLOCKS } from "@/lib/rewardsConfig";
import {
  progressState,
  settings as settingsApi,
  shop as shopApi,
  todayLocal,
  useStore,
} from "@/lib/store";
import type { AchievementUnlock, Purchase, ShopItem, XpLedgerEntry } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards — Tilth" },
      {
        name: "description",
        content: "Earn XP, level up and unlock rewards for meaningful progress.",
      },
      { property: "og:title", content: "Rewards — Tilth" },
      {
        property: "og:description",
        content: "Earn XP, level up and unlock rewards for meaningful progress.",
      },
    ],
  }),
  component: RewardsPage,
});

function RewardsPage() {
  const { t } = usePrefs();
  const ready = useStore((s) => s.ready);
  if (!ready) return <RewardsSkeleton />;
  return (
    <section>
      <PageHeader title={t.pages.rewards.title} lede={t.pages.rewards.body} />
      <div className="mt-6 space-y-4">
        <LevelPanel />
        <ChallengesPanel />
        <ShopPanel />
        <ThemesPanel />
        <AchievementsGallery />
      </div>
    </section>
  );
}

/* ---------------- level & coins ---------------- */

function LevelPanel() {
  const { t, locale } = usePrefs();
  const ledger = useStore((s) => s.xpLedger);
  const totals = totalsFromLedger(ledger);
  const todayXp = xpAwardedOnDay(ledger, todayLocal());
  const levelPct =
    totals.xpForNextLevel <= 0
      ? 0
      : Math.min(100, Math.round((totals.xpIntoLevel / totals.xpForNextLevel) * 100));
  const todayPct =
    DAILY_XP_CAP <= 0 ? 0 : Math.min(100, Math.round((todayXp / DAILY_XP_CAP) * 100));
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <span className="text-primary">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">{t.rew.levelXp}</h2>
      </div>
      <div className="flex items-center gap-4">
        <p className="font-display text-5xl font-semibold tabular-nums">
          {formatNumber(locale, totals.level)}
        </p>
        <div className="flex-1 space-y-2">
          <div>
            <div className="meter" aria-hidden>
              <div className="meter-fill" style={{ width: levelPct + "%" }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {formatNumber(locale, totals.xpIntoLevel) +
                " / " +
                formatNumber(locale, totals.xpForNextLevel) +
                " " +
                t.dash.xpUnit}
            </p>
          </div>
          <div>
            <div className="meter h-1.5" aria-hidden>
              <div className="meter-fill opacity-70" style={{ width: todayPct + "%" }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {formatNumber(locale, todayXp) +
                " / " +
                formatNumber(locale, DAILY_XP_CAP) +
                " " +
                t.rew.todayXp}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
        <Coins className="size-4 text-primary" aria-hidden />
        {formatNumber(locale, totals.coins) + " " + t.dash.coins}
      </p>
      <XpSpark ledger={ledger} />
    </div>
  );
}

function XpSpark({ ledger }: { ledger: XpLedgerEntry[] }) {
  const { t, locale } = usePrefs();
  const series = xpSeriesByDay(ledger, todayLocal(), 14);
  const max = Math.max(1, ...series.map((pt) => pt.xp));
  const W = 220;
  const H = 40;
  const pts = series.map((pt, i) => {
    const x = (i / (series.length - 1)) * (W - 8) + 4;
    const y = H - 6 - (pt.xp / max) * (H - 12);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => x + "," + y).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground">{t.review.sparkTitle}</p>
      <svg
        viewBox={"0 0 " + W + " " + H}
        className="mt-1 h-10 w-full"
        role="img"
        aria-label={t.review.sparkTitle}
        preserveAspectRatio="none"
      >
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={last[0]} cy={last[1]} r="3" fill="var(--color-primary)" />
      </svg>
      <p className="sr-only">{series.map((pt) => formatNumber(locale, pt.xp)).join(" / ")}</p>
    </div>
  );
}

/* ---------------- challenges ---------------- */

function ChallengesPanel() {
  const { t } = usePrefs();
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const ps = progressState(useStore());
  const today = todayLocal();
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <span className="text-primary">
          <Target className="size-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">{t.rew.challenges}</h2>
      </div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t.rew.dailyChallenges}
      </h3>
      <ul className="mt-2 space-y-2">
        {dailyChallenges(today).map((d) => (
          <ChallengeRow key={d.id} def={d} ps={ps} />
        ))}
      </ul>
      <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t.rew.weeklyChallenges}
      </h3>
      <ul className="mt-2 space-y-2">
        {weeklyChallenges(startOfWeek(today, weekStartsOn)).map((d) => (
          <ChallengeRow key={d.id} def={d} ps={ps} />
        ))}
      </ul>
    </div>
  );
}

function ChallengeRow({ def, ps }: { def: ChallengeDef; ps: AchievementState }) {
  const { t, locale } = usePrefs();
  const p = def.progress(ps);
  const done = p.goal > 0 && p.current >= p.goal;
  const pct = p.goal <= 0 ? 0 : Math.min(100, Math.round((p.current / p.goal) * 100));
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t.chal[def.id].name}</p>
        {done ? (
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <CheckCircle2 className="size-4" aria-hidden /> {t.rew.challengeDone}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <Coins className="size-3.5 text-primary" aria-hidden />
            {t.rew.bonus.replace("{n}", formatNumber(locale, def.bonusCoins))}
          </span>
        )}
      </div>
      <div className="meter mt-2 h-1.5" aria-hidden>
        <div className="meter-fill" style={{ width: pct + "%" }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        {formatNumber(locale, p.current) + " / " + formatNumber(locale, p.goal)}
      </p>
    </li>
  );
}

/* ---------------- achievements gallery ---------------- */

function AchievementsGallery() {
  const { t, locale } = usePrefs();
  const unlocks = useStore((s) => s.achievements);
  const ps = progressState(useStore());
  const live = unlocks.filter((u) => !u.deletedAt);
  const byId = new Map(live.map((u) => [u.achievementId, u] as const));
  const unlocked = ACHIEVEMENTS.filter((a) => byId.has(a.id));
  const locked = ACHIEVEMENTS.filter((a) => !byId.has(a.id));
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-primary">
            <Trophy className="size-4" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold">{t.settings.cards.achievements}</h2>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t.rew.unlockedCount
            .replace("{n}", formatNumber(locale, byId.size))
            .replace("{total}", formatNumber(locale, ACHIEVEMENTS.length))}
        </span>
      </div>

      <div className="mb-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t.rew.unlocked} ({unlocked.length})
        </h3>
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {unlocked.map((a) => (
            <AchievementCard key={a.id} def={a} ps={ps} unlock={byId.get(a.id)!} />
          ))}
        </ul>
      </div>

      {locked.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.rew.locked} ({locked.length})
          </h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((a) => (
              <AchievementCard key={a.id} def={a} ps={ps} unlock={null} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AchievementCard({
  def,
  ps,
  unlock,
}: {
  def: Achievement;
  ps: AchievementState;
  unlock: AchievementUnlock | null;
}) {
  const { t, locale } = usePrefs();
  const Icon = ACHIEVEMENT_ICONS[def.id] ?? Trophy;
  const unlocked = unlock !== null;
  const p = unlocked ? null : def.progress(ps);
  const [briefOpen, setBriefOpen] = useState(false);
  return (
    <li
      className={
        "rounded-lg border p-3 " + (unlocked ? "border-primary/40 bg-accent/20" : "border-border")
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            "grid size-9 shrink-0 place-items-center rounded-full " +
            (unlocked ? "bg-primary/20 text-primary" : "bg-accent/40 text-muted-foreground") +
            (def.tier === "gold"
              ? " ring-2 ring-primary/60"
              : def.tier === "silver"
                ? " ring-2 ring-muted-foreground/50"
                : def.tier === "bronze"
                  ? " ring-2 ring-warning/50"
                  : "")
          }
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
              {t.ach[def.id].name}
              {def.tier && (
                <span
                  className={
                    "chip shrink-0 " +
                    (def.tier === "gold"
                      ? "border-primary/50 text-primary"
                      : def.tier === "silver"
                        ? "border-muted-foreground/40"
                        : "border-warning/50 text-warning")
                  }
                >
                  {t.badge[def.tier]}
                </span>
              )}
            </p>
            {unlocked ? null : (
              <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.ach[def.id].desc}</p>
          {unlocked && unlock ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t.rew.unlockedOn.replace(
                "{date}",
                formatDate(locale, new Date(unlock.unlockedAt), { dateStyle: "medium" }),
              )}
            </p>
          ) : p ? (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {formatNumber(locale, p.current) + " / " + formatNumber(locale, p.target)}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t.rew.locked}</p>
          )}
          <button
            type="button"
            onClick={() => setBriefOpen((o) => !o)}
            aria-expanded={briefOpen}
            aria-label={t.rew.howToUnlock.replace("{name}", t.ach[def.id].name)}
            className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-primary transition-colors hover:text-primary/80"
          >
            {briefOpen ? (
              <ChevronUp className="size-3.5" aria-hidden />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden />
            )}
            {t.rew.howTo}
          </button>
          {briefOpen && <p className="mt-1.5 text-xs text-muted-foreground">{def.brief}</p>}
        </div>
      </div>
    </li>
  );
}

/* ---------------- shop ---------------- */

// Global :focus-visible outline is the single focus mechanism (TIL-F05).
const SHOP_FIELD = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const SHOP_SAVE_BTN = cn(buttonVariants({ size: "sm" }), "text-sm");
const SHOP_QUIET_BTN =
  "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground " +
  "transition-colors hover:bg-accent/40";
const SHOP_ICON_BTN = "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent/40";

interface ShopFormState {
  category: string;
  id: string | null;
  name: string;
  note: string;
  price: string;
}

type FlashState = { msg: string; undo?: (() => void) | undefined } | null;

function pendingPurchaseToday(
  purchases: Purchase[],
  itemId: string,
  today: string,
): Purchase | undefined {
  return purchases.find(
    (p) => !p.deletedAt && p.usedAt === undefined && p.itemId === itemId && p.localDay === today,
  );
}

function ShopPanel() {
  const { t, locale } = usePrefs();
  const ledger = useStore((s) => s.xpLedger);
  const shopItems = useStore((s) => s.shopItems);
  const purchases = useStore((s) => s.purchases);
  const coins = totalsFromLedger(ledger).coins;
  const today = todayLocal();
  const items = shopItems.filter((i) => !i.deletedAt);
  const [form, setForm] = useState<ShopFormState | null>(null);
  // One toast system app-wide (sonner) — same pill, lifetime and undo affordance
  // as every other route; the old hand-rolled fixed flash is gone.
  const setFlash = (f: FlashState) => {
    if (!f) return;
    toast(f.msg, f.undo ? { action: { label: t.shop.undo, onClick: f.undo } } : {});
  };
  const nameOk = form !== null && form.name.trim().length > 0;
  const priceOk = form !== null && Number.isInteger(Number(form.price)) && Number(form.price) >= 1;

  const buy = (item: ShopItem) => {
    const res = shopApi.buy(item.id);
    if (res.ok) {
      setFlash({ msg: t.shop.boughtToast.replace("{name}", item.name) });
    } else if (res.reason === "insufficient-coins") {
      setFlash({
        msg: t.shop.needMoreCoins.replace("{n}", formatNumber(locale, item.price - coins)),
      });
    } else if (res.reason === "pending-today") {
      setFlash({ msg: t.shop.alreadyToday });
    }
  };

  const save = () => {
    if (!form || !nameOk || !priceOk) return;
    const name = form.name.trim();
    const price = Number(form.price);
    const note = form.note.trim();
    if (form.id) {
      shopApi.updateItem(form.id, {
        name,
        note: note || undefined,
        price,
        category: isShopCategory(form.category) ? form.category : undefined,
      });
    } else {
      shopApi.addItem({
        name,
        note: note || undefined,
        price,
        category: isShopCategory(form.category) ? form.category : undefined,
      });
    }
    setForm(null);
  };

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-primary">
            <ShoppingBag className="size-4" aria-hidden />
          </span>
          <h2 className="text-sm font-semibold">{t.shop.title}</h2>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <Coins className="size-3.5 text-primary" aria-hidden />
          {formatNumber(locale, coins) + " " + t.dash.coins}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t.shop.subtitle}</p>

      {form ? (
        <div className="mt-3 rounded-lg border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {t.shop.name}
              </span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.shop.namePh}
                className={SHOP_FIELD}
              />
              {nameOk ? null : (
                <span className="mt-1 block text-xs text-destructive">{t.shop.nameRequired}</span>
              )}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {t.shop.price}
              </span>
              <input
                inputMode="numeric"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="1"
                className={SHOP_FIELD + " tabular-nums"}
              />
              {priceOk ? null : (
                <span className="mt-1 block text-xs text-destructive">{t.shop.priceInvalid}</span>
              )}
            </label>
          </div>
          <label className="mt-2 block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {t.shop.note}
            </span>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t.shop.notePh}
              className={SHOP_FIELD}
            />
          </label>
          <label className="mt-2 block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {t.shop.category}
            </span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              aria-label={t.shop.category}
              className={SHOP_FIELD}
            >
              <option value="">{t.shop.none}</option>
              {SHOP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.shop.categories[c]}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={save} className={SHOP_SAVE_BTN}>
              {t.shop.save}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
            >
              {t.shop.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setForm({ id: null, name: "", note: "", price: "", category: "" })}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/30"
        >
          <Plus className="size-4" aria-hidden /> {t.shop.addItem}
        </button>
      )}

      {items.length === 0 && !form ? (
        <div className="empty-card mt-3 py-8">
          <span className="grid size-12 place-items-center rounded-full bg-accent/40 text-primary">
            <ShoppingBag className="size-6" aria-hidden />
          </span>
          <p className="text-sm font-medium">{t.shop.emptyTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.shop.emptyBody}</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const pending = pendingPurchaseToday(purchases, item.id, today);
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {item.name}
                    {item.category && isShopCategory(item.category) && (
                      <span className="chip shrink-0">{t.shop.categories[item.category]}</span>
                    )}
                  </p>
                  {item.note ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.note}</p>
                  ) : null}
                  {pending ? (
                    <p className="mt-1 text-xs text-muted-foreground">{t.shop.alreadyToday}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-end text-xs text-muted-foreground tabular-nums">
                  {formatNumber(locale, item.price) + " " + t.dash.coins}
                  {coins < item.price && (
                    <span className="block text-warning">
                      {t.shop.balanceHint.replace("{n}", formatNumber(locale, coins))}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={t.shop.edit}
                    onClick={() =>
                      setForm({
                        id: item.id,
                        name: item.name,
                        note: item.note ?? "",
                        price: String(item.price),
                        category: item.category ?? "",
                      })
                    }
                    className={SHOP_ICON_BTN}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={t.shop.delete}
                    onClick={() => {
                      shopApi.removeItem(item.id);
                      setFlash({
                        msg: t.shop.deletedToast,
                        undo: () => shopApi.restoreItem(item.id),
                      });
                    }}
                    className={SHOP_ICON_BTN}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => buy(item)}
                    disabled={!!pending}
                    className={SHOP_SAVE_BTN + " disabled:pointer-events-none disabled:opacity-50"}
                  >
                    {t.shop.buy}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t.shop.history}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{t.shop.historyHint}</p>
      {purchaseHistory(purchases).length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{t.shop.historyEmpty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {purchaseHistory(purchases).map((p) => (
            <HistoryRow key={p.id} purchase={p} today={today} onFlash={setFlash} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryRow({
  purchase,
  today,
  onFlash,
}: {
  purchase: Purchase;
  today: string;
  onFlash: (f: FlashState) => void;
}) {
  const { t, locale } = usePrefs();
  const refunded = purchase.deletedAt !== undefined;
  const used = purchase.usedAt !== undefined;
  const refundable = !refunded && !used && purchase.localDay === today;
  const day = formatDate(locale, new Date(purchase.localDay + "T12:00:00Z"), {
    dateStyle: "medium",
  });
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <div className="min-w-0 flex-1">
        <p
          className={
            "truncate text-sm font-medium " + (refunded ? "text-muted-foreground line-through" : "")
          }
        >
          {purchase.name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {day + " · " + formatNumber(locale, purchase.price) + " " + t.dash.coins}
        </p>
      </div>
      {refunded ? (
        <span className="shrink-0 rounded-full bg-accent/50 px-2 py-0.5 text-xs text-muted-foreground">
          {t.shop.refundedLabel}
        </span>
      ) : used ? (
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
          {t.shop.usedLabel}
        </span>
      ) : null}
      {!refunded && (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={used ? t.shop.unmarkUsed : t.shop.markUsed}
            onClick={() => shopApi.setUsed(purchase.id, !used)}
            className={SHOP_ICON_BTN}
          >
            {used ? (
              <RotateCcw className="size-4" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden />
            )}
          </button>
          {refundable && (
            <button
              type="button"
              onClick={() => {
                const res = shopApi.refund(purchase.id);
                if (res.ok) onFlash({ msg: t.shop.refundToast.replace("{name}", purchase.name) });
              }}
              className={SHOP_QUIET_BTN}
            >
              {t.shop.refund}
            </button>
          )}
        </span>
      )}
    </li>
  );
}

/* ---------------- accent themes ---------------- */

function ThemesPanel() {
  const { t, locale, accent, setAccent } = usePrefs();
  const ledger = useStore((s) => s.xpLedger);
  const unlocks = useStore((s) => s.achievements);
  const state: ThemeUnlockState = {
    level: totalsFromLedger(ledger).level,
    unlockedAchievements: unlocks.filter((u) => !u.deletedAt).map((u) => u.achievementId),
  };
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <span className="text-primary">
          <Palette className="size-4" aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">{t.themes.title}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{t.themes.subtitle}</p>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {THEMES.map((th) => {
          const rule = THEME_UNLOCKS[th.id];
          const unlocked = isThemeUnlocked(th.id, state);
          let sub: string;
          if (!unlocked) {
            if (rule.type === "level") {
              sub = t.themes.unlockLevel.replace("{level}", formatNumber(locale, rule.level));
            } else if (rule.type === "achievement") {
              sub = t.themes.unlockAchievement.replace("{name}", t.ach[rule.achievementId].name);
            } else {
              sub = t.themes.default;
            }
          } else if (accent === th.id) {
            sub = t.themes.selected;
          } else {
            sub = rule.type === "default" ? t.themes.default : t.themes.current;
          }
          const base =
            "flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors ";
          const cls =
            base +
            (accent === th.id
              ? "border-primary/60 bg-accent/30"
              : "border-border hover:bg-accent/20") +
            (unlocked ? "" : " cursor-not-allowed opacity-70");
          return (
            <li key={th.id}>
              <button
                type="button"
                disabled={!unlocked}
                aria-pressed={accent === th.id}
                onClick={() => {
                  if (!unlocked) return;
                  setAccent(th.id);
                  settingsApi.update({ accent: th.id });
                }}
                className={cls}
              >
                <span
                  className="theme-swatch size-5 shrink-0 rounded-full border border-border"
                  style={{ "--swatch-hue": th.hue } as CSSProperties}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t.themes.names[th.id]}</span>
                  <span className="block text-xs text-muted-foreground">{sub}</span>
                </span>
                {unlocked ? null : (
                  <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- skeleton ---------------- */

function RewardsSkeleton() {
  return (
    <section aria-busy="true">
      <div className="mb-2 h-4 w-14 skeleton" />
      <div className="h-9 w-64 max-w-full skeleton" />
      <div className="mt-3 h-4 w-80 max-w-full skeleton" />
      <div className="mt-6 h-32 skeleton rounded-xl" />
      <div className="mt-4 h-48 skeleton rounded-xl" />
      <div className="mt-4 h-64 skeleton rounded-xl" />
      <div className="mt-4 h-64 skeleton rounded-xl" />
    </section>
  );
}
