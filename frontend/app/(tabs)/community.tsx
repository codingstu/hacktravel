/**
 * Tab2 抄作业 — 社区精选路线（v3 杂志风重构）
 *
 * 设计语言：
 * - 去掉 emoji 标题，用干净排版 + 色块层次
 * - 卡片带左侧色条（accent strip）
 * - 展开详情用紧凑时间轴，不重复圆点
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Spacing,
  FontSize,
  FontWeight,
  BorderRadius,
  Shadow,
} from '@/constants/Theme';
import { PRESET_ROUTES } from '@/services/presets';
import type { CommunityRoute, ItineraryLeg } from '@/services/types';

const ACTIVITY_ICON_MAP: Record<string, { name: string; color: string }> = {
  food: { name: 'restaurant', color: '#E88A3A' },
  transit: { name: 'bus', color: '#5B8DEF' },
  attraction: { name: 'camera', color: '#A96FDB' },
  rest: { name: 'bed', color: '#6BC5A0' },
  shopping: { name: 'bag-handle', color: '#E86B8A' },
  flight: { name: 'airplane', color: '#5B8DEF' },
};

export default function CommunityScreen() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>精选路线</Text>
        <Text style={styles.headerSub}>
          被验证过的极限行程，直接抄作业省心省力
        </Text>
      </View>

      {/* 路线卡片 */}
      {PRESET_ROUTES.map(route => (
        <RouteCard
          key={route.id}
          route={route}
          expanded={expandedId === route.id}
          onToggle={() => toggleExpand(route.id)}
        />
      ))}

      {/* 底部说明 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          更多路线持续更新中 · 你生成的路线也会被收录
        </Text>
      </View>
    </ScrollView>
  );
}

function RouteCard({
  route,
  expanded,
  onToggle,
}: {
  route: CommunityRoute;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.card}>
      {/* accent 色条 */}
      <View style={styles.accentStrip} />

      <View style={styles.cardBody}>
        {/* 头部 */}
        <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
          <View style={styles.cardTop}>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>热门</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>{route.title}</Text>
            <View style={styles.metaRow}>
              <MetaChip label={`${route.total_hours}H`} />
              <MetaChip label={`¥${route.budget.amount}`} />
              <MetaChip label={`${route.copy_count} 人已抄`} />
            </View>
            <View style={styles.tagRow}>
              {route.tags.map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>
              {expanded ? '收起' : '查看完整路线'}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {/* 展开详情 */}
        {expanded && (
          <View style={styles.detail}>
            {route.legs.map((leg, i) => (
              <LegRow key={i} leg={leg} isLast={i === route.legs.length - 1} />
            ))}

            {/* 操作 */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.copyBtn} activeOpacity={0.85}>
                <Ionicons name="copy-outline" size={15} color="#fff" />
                <Text style={styles.copyBtnText}>我也要抄</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} activeOpacity={0.7}>
                <Ionicons name="share-social-outline" size={15} color={Colors.primary} />
                <Text style={styles.shareBtnText}>分享</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

function LegRow({ leg, isLast }: { leg: ItineraryLeg; isLast: boolean }) {
  const startTime = leg.start_time_local.slice(11, 16);
  const iconInfo = ACTIVITY_ICON_MAP[leg.activity_type] || {
    name: 'location',
    color: Colors.primary,
  };

  return (
    <View style={styles.legRow}>
      {/* 时间轴 */}
      <View style={styles.legRail}>
        <View style={[styles.legDot, { backgroundColor: iconInfo.color }]}>
          <Ionicons name={iconInfo.name as any} size={10} color="#fff" />
        </View>
        {!isLast && <View style={styles.legLine} />}
      </View>
      {/* 信息 */}
      <View style={[styles.legInfo, isLast && { paddingBottom: 0 }]}>
        <View style={styles.legMain}>
          <Text style={styles.legName}>{leg.place.name}</Text>
          <Text style={styles.legCost}>¥{leg.estimated_cost.amount}</Text>
        </View>
        <Text style={styles.legTime}>{startTime}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingBottom: 100,
  },

  // ── Header
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // ── Card
  card: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    ...Shadow.md,
  },
  accentStrip: {
    width: 4,
    backgroundColor: Colors.primary,
  },
  cardBody: {
    flex: 1,
  },
  cardTop: {
    padding: Spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  badge: {
    backgroundColor: Colors.accent + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  badgeText: {
    fontSize: FontSize.xs,
    color: '#B07A18',
    fontWeight: FontWeight.semibold,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  metaChip: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  metaChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  tagRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tag: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.tag.text,
    fontWeight: FontWeight.semibold,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    gap: 4,
  },
  toggleText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },

  // ── Detail
  detail: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  legRail: {
    width: 24,
    alignItems: 'center',
  },
  legDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  legLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: Colors.divider,
    marginVertical: 2,
  },
  legInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  legMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legName: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  legCost: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    marginLeft: Spacing.sm,
  },
  legTime: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 2,
  },

  // ── Actions
  actionRow: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    ...Shadow.colored(Colors.primary),
  },
  copyBtnText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  shareBtnText: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },

  // ── Footer
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  footerText: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
});
