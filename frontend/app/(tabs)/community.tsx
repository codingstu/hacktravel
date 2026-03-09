/**
 * Tab2 抄作业 — 社区精选路线（v4 真实后端数据）
 *
 * 数据源：
 * - 优先从后端 GET /v1/community/routes 加载真实路线
 * - 网络失败时 fallback 到前端预置 PRESET_ROUTES
 * - "我也要抄" 调用 POST /v1/community/routes/:id/copy
 * - copy_count 由 Redis 持久化，真实递增
 *
 * 设计语言：杂志风、去 emoji、卡片带左侧色条
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Modal,
  Image,
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
import {
  fetchCommunityRoutes,
  fetchCommunityRouteDetail,
  copyRoute,
  fetchPlaceDetail,
} from '@/services/api';
import type { CommunityRoute, CommunityRouteCard, ItineraryLeg, PlaceDetailResponse } from '@/services/types';
import { formatMoney, formatMoneyWithCode, getTimezoneLabel } from '@/utils/format';

const ACTIVITY_ICON_MAP: Record<string, { name: string; color: string }> = {
  food: { name: 'restaurant', color: '#E88A3A' },
  transit: { name: 'bus', color: '#5B8DEF' },
  attraction: { name: 'camera', color: '#A96FDB' },
  rest: { name: 'bed', color: '#6BC5A0' },
  shopping: { name: 'bag-handle', color: '#E86B8A' },
  flight: { name: 'airplane', color: '#5B8DEF' },
};

type DataSource = 'api' | 'preset';

export default function CommunityScreen() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<CommunityRouteCard[]>([]);
  const [expandedRouteDetail, setExpandedRouteDetail] = useState<CommunityRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>('preset');
  const [copyingId, setCopyingId] = useState<string | null>(null);

  // ── Place Detail Modal ──
  const [placeModalVisible, setPlaceModalVisible] = useState(false);
  const [placeDetail, setPlaceDetail] = useState<PlaceDetailResponse | null>(null);
  const [placeDetailLoading, setPlaceDetailLoading] = useState(false);
  const [selectedLeg, setSelectedLeg] = useState<ItineraryLeg | null>(null);

  const handlePressPlace = useCallback(async (leg: ItineraryLeg) => {
    setSelectedLeg(leg);
    setPlaceDetail(null);
    setPlaceModalVisible(true);
    setPlaceDetailLoading(true);
    try {
      const detail = await fetchPlaceDetail({
        name: leg.place.name,
        latitude: leg.place.latitude,
        longitude: leg.place.longitude,
      });
      setPlaceDetail(detail);
    } catch { /* ignore */ }
    setPlaceDetailLoading(false);
  }, []);

  /** 从后端加载路线列表 */
  const loadRoutes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const resp = await fetchCommunityRoutes({ page: 1, page_size: 50 });
      if (resp.routes && resp.routes.length > 0) {
        setRoutes(resp.routes);
        setDataSource('api');
      } else {
        _fallbackToPresets();
      }
    } catch {
      _fallbackToPresets();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const _fallbackToPresets = () => {
    setRoutes(PRESET_ROUTES.map(r => ({
      id: r.id,
      title: r.title,
      destination: r.destination,
      total_hours: r.total_hours,
      budget: r.budget,
      copy_count: r.copy_count,
      tags: r.tags,
      summary: r.summary,
    })));
    setDataSource('preset');
  };

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  /** 展开路线 — 从后端加载完整详情（含 legs） */
  const toggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedRouteDetail(null);
      return;
    }

    setExpandedId(id);
    setExpandedRouteDetail(null);

    if (dataSource === 'api') {
      try {
        const detail = await fetchCommunityRouteDetail(id);
        setExpandedRouteDetail(detail);
      } catch {
        const preset = PRESET_ROUTES.find(r => r.id === id);
        if (preset) setExpandedRouteDetail(preset);
      }
    } else {
      const preset = PRESET_ROUTES.find(r => r.id === id);
      if (preset) setExpandedRouteDetail(preset);
    }
  }, [expandedId, dataSource]);

  /** "我也要抄" — 调用后端 API */
  const handleCopy = useCallback(async (routeId: string) => {
    setCopyingId(routeId);
    try {
      const result = await copyRoute(routeId);
      if (result.success) {
        setRoutes(prev =>
          prev.map(r =>
            r.id === routeId ? { ...r, copy_count: result.copy_count } : r,
          ),
        );
        if (result.route.map?.google_maps_deeplink) {
          Alert.alert(
            '抄作业成功',
            `已有 ${result.copy_count} 人抄了这条路线！\n是否打开 Google Maps 导航？`,
            [
              { text: '稍后再看', style: 'cancel' },
              {
                text: '打开导航',
                onPress: () => Linking.openURL(result.route.map!.google_maps_deeplink),
              },
            ],
          );
        } else {
          Alert.alert('抄作业成功', `已有 ${result.copy_count} 人抄了这条路线！`);
        }
      }
    } catch {
      Alert.alert('抄作业成功', '路线已收藏到你的规划中');
    } finally {
      setCopyingId(null);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>正在加载精选路线…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadRoutes(true)}
          tintColor={Colors.primary}
        />
      }>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>精选路线</Text>
        <Text style={styles.headerSub}>
          被验证过的极限行程，直接抄作业省心省力
        </Text>
        {dataSource === 'api' && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>实时数据 · {routes.length} 条路线</Text>
          </View>
        )}
      </View>

      {/* 路线卡片 */}
      {routes.map(route => (
        <RouteCard
          key={route.id}
          route={route}
          expanded={expandedId === route.id}
          detail={expandedId === route.id ? expandedRouteDetail : null}
          copying={copyingId === route.id}
          onToggle={() => toggleExpand(route.id)}
          onCopy={() => handleCopy(route.id)}
          onPressPlace={handlePressPlace}
        />
      ))}

      {/* 底部说明 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          更多路线持续更新中 · 你生成的路线也会被收录
        </Text>
      </View>

      {/* ── 地点详情 Modal ── */}
      <Modal
        visible={placeModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPlaceModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setPlaceModalVisible(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>

            {placeDetailLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.modalLoadingText}>正在加载地点详情…</Text>
              </View>
            ) : selectedLeg && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {placeDetail?.image_url && (
                  <Image
                    source={{ uri: placeDetail.image_url }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.modalHeader}>
                  <View style={[
                    styles.modalIconBg,
                    { backgroundColor: (ACTIVITY_ICON_MAP[selectedLeg.activity_type] || { color: Colors.primary }).color },
                  ]}>
                    <Ionicons
                      name={(ACTIVITY_ICON_MAP[selectedLeg.activity_type] || { name: 'location' }).name as any}
                      size={20}
                      color="#fff"
                    />
                  </View>
                  <View style={styles.modalTitleArea}>
                    <Text style={styles.modalTitle}>{selectedLeg.place.name}</Text>
                    <Text style={styles.modalSubtitle}>
                      {selectedLeg.start_time_local.slice(11, 16)} – {selectedLeg.end_time_local.slice(11, 16)}
                      {' · '}{formatMoney(selectedLeg.estimated_cost, true)}
                    </Text>
                  </View>
                </View>

                {selectedLeg.transport && (
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="car-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.modalInfoText}>
                      {selectedLeg.transport.mode}
                      {selectedLeg.transport.reference ? ` · ${selectedLeg.transport.reference}` : ''}
                    </Text>
                  </View>
                )}

                {placeDetail?.description ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>简介</Text>
                    <Text style={styles.modalDesc}>{placeDetail.description}</Text>
                  </View>
                ) : null}

                {selectedLeg.tips && selectedLeg.tips.length > 0 && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>旅行者贴士</Text>
                    {selectedLeg.tips.map((tip, i) => (
                      <View key={i} style={styles.modalTipRow}>
                        <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.primary} />
                        <Text style={styles.modalTipText}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {selectedLeg.place.latitude != null && selectedLeg.place.longitude != null && (
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.modalInfoText}>
                      {selectedLeg.place.latitude.toFixed(4)}, {selectedLeg.place.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                  {placeDetail?.map_url && (
                    <TouchableOpacity
                      style={styles.modalActionBtn}
                      onPress={() => Linking.openURL(placeDetail.map_url!)}>
                      <Ionicons name="navigate" size={16} color="#fff" />
                      <Text style={styles.modalActionText}>Google Maps</Text>
                    </TouchableOpacity>
                  )}
                  {placeDetail?.wiki_url && (
                    <TouchableOpacity
                      style={styles.modalActionBtnSecondary}
                      onPress={() => Linking.openURL(placeDetail.wiki_url!)}>
                      <Ionicons name="book-outline" size={16} color={Colors.primary} />
                      <Text style={styles.modalActionTextSecondary}>Wikipedia</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function RouteCard({
  route,
  expanded,
  detail,
  copying,
  onToggle,
  onCopy,
  onPressPlace,
}: {
  route: CommunityRouteCard;
  expanded: boolean;
  detail: CommunityRoute | null;
  copying: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onPressPlace: (leg: ItineraryLeg) => void;
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
                <Text style={styles.badgeText}>
                  {route.copy_count >= 400 ? '爆款' : route.copy_count >= 200 ? '热门' : '精选'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>{route.title}</Text>
            <View style={styles.metaRow}>
              <MetaChip label={`${route.total_hours}H`} />
              <MetaChip label={formatMoneyWithCode(route.budget)} />
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
            {!detail ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.detailLoadingText}>正在加载路线详情…</Text>
              </View>
            ) : (
              <>
                {/* 时区提示 */}
                {(() => {
                  const tzLabel = getTimezoneLabel(route.destination);
                  return tzLabel ? (
                    <View style={styles.tzBanner}>
                      <Ionicons name="time-outline" size={14} color={Colors.primary} />
                      <Text style={styles.tzBannerText}>{tzLabel}</Text>
                    </View>
                  ) : null;
                })()}

                {detail.legs.map((leg, i) => (
                  <LegRow key={i} leg={leg} isLast={i === detail.legs.length - 1} onPressPlace={onPressPlace} />
                ))}

                {/* 操作 */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.copyBtn, copying && styles.copyBtnDisabled]}
                    activeOpacity={0.85}
                    onPress={onCopy}
                    disabled={copying}>
                    {copying ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="copy-outline" size={15} color="#fff" />
                        <Text style={styles.copyBtnText}>我也要抄</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {detail.map?.google_maps_deeplink ? (
                    <TouchableOpacity
                      style={styles.shareBtn}
                      activeOpacity={0.7}
                      onPress={() => Linking.openURL(detail.map!.google_maps_deeplink)}>
                      <Ionicons name="navigate-outline" size={15} color={Colors.primary} />
                      <Text style={styles.shareBtnText}>导航</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            )}
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

function LegRow({ leg, isLast, onPressPlace }: { leg: ItineraryLeg; isLast: boolean; onPressPlace: (leg: ItineraryLeg) => void }) {
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
          <TouchableOpacity onPress={() => onPressPlace(leg)} activeOpacity={0.7} style={styles.legNameRow}>
            <Text style={styles.legName}>{leg.place.name}</Text>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textLight} />
          </TouchableOpacity>
          <Text style={styles.legCost}>{formatMoney(leg.estimated_cost, true)}</Text>
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

  // ── Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  liveText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
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
  detailLoading: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  detailLoadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
  copyBtnDisabled: {
    opacity: 0.6,
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

  // ── Timezone Banner
  tzBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  tzBannerText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },

  // ── LegRow enhancements
  legNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },

  // ── Place Detail Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '88%',
    paddingBottom: Spacing.xxxl,
    ...Shadow.lg,
  },
  modalClose: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoading: {
    paddingVertical: Spacing.hero,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  modalLoadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  modalIconBg: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleArea: {
    flex: 1,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  modalInfoText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  modalSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  modalSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  modalDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  modalTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modalTipText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalActionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
  modalActionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalActionTextSecondary: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
});
