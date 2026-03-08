/**
 * Tab2 抄作业 – 社区精选路线瀑布流
 * 蓝图 Section 6.2：瀑布流卡片 + 详情 + "我也要抄"快捷生成
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/Theme';
import { PRESET_ROUTES } from '@/services/presets';
import type { CommunityRoute, ItineraryLeg } from '@/services/types';

const ACTIVITY_ICONS: Record<string, string> = {
  food: '🍜',
  transit: '🚌',
  attraction: '🏛️',
  rest: '🛏️',
  shopping: '🛍️',
  flight: '✈️',
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
      {/* 头部说明 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>社区精选路线</Text>
        <Text style={styles.headerSubtitle}>
          被验证过的极限路线，直接抄作业省心省力
        </Text>
      </View>

      {/* 路线卡片列表 */}
      {PRESET_ROUTES.map(route => (
        <RouteCard
          key={route.id}
          route={route}
          expanded={expandedId === route.id}
          onToggle={() => toggleExpand(route.id)}
        />
      ))}

      {/* 底部提示 */}
      <View style={styles.footer}>
        <Ionicons name="sparkles" size={18} color={Colors.textLight} />
        <Text style={styles.footerText}>
          更多路线持续更新中，你生成的路线也会被收录哦~
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
      {/* 卡片头 */}
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>🔥 热门</Text>
          </View>
          <Text style={styles.cardTitle}>{route.title}</Text>
          <View style={styles.cardMeta}>
            <MetaChip icon="⏱" text={`${route.total_hours}H`} />
            <MetaChip icon="💰" text={`¥${route.budget.amount}`} />
            <MetaChip icon="📋" text={`${route.copy_count}人已抄`} />
          </View>
          <View style={styles.tagContainer}>
            {route.tags.map(tag => (
              <View key={tag} style={styles.cardTag}>
                <Text style={styles.cardTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.expandHint}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textSecondary}
          />
          <Text style={styles.expandText}>
            {expanded ? '收起详情' : '查看完整路线'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* 展开详情 */}
      {expanded && (
        <View style={styles.detailSection}>
          <View style={styles.divider} />
          {route.legs.map((leg, i) => (
            <LegItem key={i} leg={leg} />
          ))}

          {/* 操作按钮 */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.copyBtn}>
              <Ionicons name="copy" size={16} color="#fff" />
              <Text style={styles.copyBtnText}>  我也要抄</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn}>
              <Ionicons name="share-social" size={16} color={Colors.primary} />
              <Text style={styles.shareBtnText}>  分享</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function MetaChip({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipText}>
        {icon} {text}
      </Text>
    </View>
  );
}

function LegItem({ leg }: { leg: ItineraryLeg }) {
  const startTime = leg.start_time_local.slice(11, 16);
  const icon = ACTIVITY_ICONS[leg.activity_type] || '📍';

  return (
    <View style={styles.legItem}>
      <Text style={styles.legTime}>{startTime}</Text>
      <View style={styles.legDot} />
      <View style={styles.legInfo}>
        <Text style={styles.legName}>
          {icon} {leg.place.name}
        </Text>
        <Text style={styles.legCost}>¥{leg.estimated_cost.amount}</Text>
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
  header: {
    padding: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: Spacing.lg,
  },
  cardBadge: {
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  cardBadgeText: {
    fontSize: FontSize.xs,
    color: '#92400E',
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  metaChip: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  metaChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tagContainer: {
    flexDirection: 'row',
  },
  cardTag: {
    backgroundColor: Colors.tag.bg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  cardTagText: {
    fontSize: FontSize.xs,
    color: Colors.tag.text,
    fontWeight: '600',
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  expandText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  // ── Detail ──
  detailSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  legItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  legTime: {
    width: 44,
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  legDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.timeline,
    marginHorizontal: Spacing.sm,
  },
  legInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legName: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
  },
  legCost: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  // ── Actions ──
  actionRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
  },
  copyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.tag.bg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  shareBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  // ── Footer ──
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  footerText: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginLeft: Spacing.sm,
  },
});
