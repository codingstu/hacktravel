/**
 * TravelItemCard — 统一时间轴单条 Leg 卡片
 *
 * 支持两种视觉模式：
 * - `full`（默认）：完整卡片，含时间区间、费用右对齐、tips、编辑操作。用于 Plan 页。
 * - `compact`：紧凑行式，单行时间 + 地点 + 费用。用于 Guides/社区展开详情。
 *
 * 替代 index.tsx 的 `TimelineLeg` 和 community.tsx 的 `LegRow`。
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, BorderRadius, Shadow } from '@/constants/Theme';
import { ACTIVITY_ICON_MAP } from '@/constants/activityIcons';
import type { ItineraryLeg } from '@/services/types';

/** 格式化 Money 值 — 简版，只显示符号+数字 */
function formatCost(cost: { amount: number; currency: string }): string {
  const symbols: Record<string, string> = { CNY: '¥', USD: '$', EUR: '€', GBP: '£', JPY: '¥', THB: '฿', KRW: '₩' };
  return `${symbols[cost.currency] ?? ''}${Math.round(cost.amount)}`;
}

interface TravelItemCardProps {
  leg: ItineraryLeg;
  isLast: boolean;
  /** `full` 显示完整卡片（Plan 页），`compact` 紧凑行（社区/攻略） */
  variant?: 'full' | 'compact';
  /** 编辑模式相关 */
  isEditing?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  /** 点击地点弹出详情 */
  onPressPlace?: () => void;
}

function TravelItemCardInner({
  leg,
  isLast,
  variant = 'full',
  isEditing = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onDelete,
  onPressPlace,
}: TravelItemCardProps) {
  const startTime = leg.start_time_local.slice(11, 16);
  const endTime = leg.end_time_local.slice(11, 16);
  const iconInfo = ACTIVITY_ICON_MAP[leg.activity_type] ?? { name: 'location', color: Colors.primary };

  if (variant === 'compact') {
    return (
      <View style={s.compactRow}>
        <View style={s.compactRail}>
          <View style={[s.compactDotRing, { borderColor: `${iconInfo.color}30` }]}>
            <View style={[s.compactDot, { backgroundColor: iconInfo.color }]} />
          </View>
          {!isLast && <View style={s.compactLine} />}
        </View>
        <View style={[s.compactInfo, isLast && { paddingBottom: 0 }]}>
          <Text style={s.compactTime}>{startTime}</Text>
          <View style={s.compactMain}>
            <TouchableOpacity
              onPress={onPressPlace}
              activeOpacity={onPressPlace ? 0.7 : 1}
              disabled={!onPressPlace}
              style={s.compactNameRow}>
              <Text style={s.compactName} numberOfLines={1}>{leg.place.name}</Text>
              {onPressPlace && <Ionicons name="information-circle-outline" size={14} color={Colors.textLight} />}
            </TouchableOpacity>
            <Text style={s.compactCost}>{formatCost(leg.estimated_cost)}</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Full variant ──
  return (
    <View style={s.fullRow}>
      {/* 左侧时间轴导轨 */}
      <View style={s.fullRail}>
        <View style={[s.fullDot, { backgroundColor: iconInfo.color }]}>
          <Ionicons name={iconInfo.name as any} size={14} color={Colors.accent} />
        </View>
        {!isLast && <View style={s.fullLine} />}
      </View>

      {/* 右侧内容卡 */}
      <View style={[s.fullCard, isLast && { marginBottom: 0 }]}>
        {/* 头部：时间 + 费用右对齐 */}
        <View style={s.fullHeader}>
          <Text style={s.fullTime}>{startTime} – {endTime}</Text>
          <View style={s.fullRight}>
            <Text style={s.fullCost}>{formatCost(leg.estimated_cost)}</Text>
            {isEditing && (
              <View style={s.editBtns}>
                <TouchableOpacity
                  style={[s.editBtn, !canMoveUp && s.editBtnDisabled]}
                  onPress={canMoveUp ? onMoveUp : undefined}>
                  <Ionicons name="chevron-up" size={14} color={canMoveUp ? Colors.primary : Colors.textLight} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.editBtn, !canMoveDown && s.editBtnDisabled]}
                  onPress={canMoveDown ? onMoveDown : undefined}>
                  <Ionicons name="chevron-down" size={14} color={canMoveDown ? Colors.primary : Colors.textLight} />
                </TouchableOpacity>
                <TouchableOpacity style={[s.editBtn, s.deleteBtn]} onPress={onDelete}>
                  <Ionicons name="trash-outline" size={14} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* 地点名称行 */}
        <TouchableOpacity
          activeOpacity={onPressPlace ? 0.6 : 1}
          onPress={onPressPlace}
          disabled={!onPressPlace}>
          <View style={s.placeRow}>
            <Text style={s.placeName}>{leg.place.name}</Text>
            {onPressPlace && <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />}
          </View>
        </TouchableOpacity>

        {/* 交通信息 */}
        {leg.transport && (
          <Text style={s.transport}>
            {leg.transport.mode}{leg.transport.reference ? ` · ${leg.transport.reference}` : ''}
          </Text>
        )}

        {/* Tips */}
        {leg.tips && leg.tips.length > 0 && (
          <View style={s.tips}>
            {leg.tips.map((tip, i) => (
              <Text key={i} style={s.tipText}>{tip}</Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export const TravelItemCard = React.memo(TravelItemCardInner);

/* ─── Styles ─── */

const s = StyleSheet.create({
  // ── Full variant ──
  fullRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
  },
  fullRail: {
    alignItems: 'center',
    width: 28,
    marginRight: Spacing.md,
  },
  fullDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.timelineFaded,
    marginVertical: Spacing.xs,
  },
  fullCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  fullHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  fullTime: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  fullRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fullCost: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  placeName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    flex: 1,
  },
  transport: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  tips: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  tipText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    lineHeight: FontSize.xs * 1.5,
  },
  editBtns: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  editBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
  },
  editBtnDisabled: {
    opacity: 0.4,
  },
  deleteBtn: {
    backgroundColor: '#fef2f2',
  },

  // ── Compact variant ──
  compactRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
  },
  compactRail: {
    alignItems: 'center',
    width: 20,
    marginRight: Spacing.md,
  },
  compactDotRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  compactLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.timelineFaded,
    marginVertical: 2,
  },
  compactInfo: {
    flex: 1,
    paddingBottom: Spacing.md,
  },
  compactTime: {
    fontSize: FontSize.xxs,
    color: Colors.textLight,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  compactMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  compactName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.text,
    flex: 1,
  },
  compactCost: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginLeft: Spacing.sm,
  },
});
