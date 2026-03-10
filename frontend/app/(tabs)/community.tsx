/**
 * Tab2 Travel Guides — 社区精选路线（v8 Stitch 统一风格）
 *
 * 数据源：
 * - 优先从后端 GET /v1/community/routes 加载真实路线
 * - 网络失败时 fallback 到前端预置 PRESET_ROUTES
 * - "我也要抄" 调用 POST /v1/community/routes/:id/copy
 * - copy_count 由 Redis 持久化，真实递增
 *
 * 设计语言：Stitch — 圆角 xl 卡片、primary/10 背景、timeline dot+ring
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  saveItinerary,
} from '@/services/api';
import type { CommunityRoute, CommunityRouteCard, ItineraryLeg, PlaceDetailResponse } from '@/services/types';
import { formatMoney, formatMoneyWithCode, getTimezoneLabel } from '@/utils/format';
import { getDestinationImage } from '@/services/images';
import { t } from '@/services/i18n';

const ACTIVITY_ICON_MAP: Record<string, { name: string; color: string }> = {
  food: { name: 'restaurant', color: '#E88A3A' },
  transit: { name: 'bus', color: '#5B8DEF' },
  attraction: { name: 'camera', color: '#A96FDB' },
  rest: { name: 'bed', color: '#6BC5A0' },
  shopping: { name: 'bag-handle', color: '#E86B8A' },
  flight: { name: 'airplane', color: '#5B8DEF' },
};

type DataSource = 'api' | 'preset';

/** Category tab keys for filtering */
type CategoryTab = 'verified' | 'hot' | 'bestSellers' | 'budget';

/** Filter chip keys */
type FilterTag = 'budget' | 'foodie' | 'hiking' | 'photo';

/** Tag matching map: filter key → matching Chinese tag keywords */
const FILTER_TAG_MATCH: Record<FilterTag, string[]> = {
  budget: ['穷游', '穷鬼', '省钱', '极限'],
  foodie: ['吃货', '美食', '夜市', '拉面'],
  hiking: ['暴走', '徒步', '城市漫游', '山'],
  photo: ['打卡', '摄影', '壁画', '出片'],
};

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<CommunityRouteCard[]>([]);
  const [expandedRouteDetail, setExpandedRouteDetail] = useState<CommunityRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>('preset');
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 2000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // ── Tab & Filter state ──
  const [selectedCategory, setSelectedCategory] = useState<CategoryTab>('hot');
  const [selectedFilter, setSelectedFilter] = useState<FilterTag | null>(null);

  /** Filtered & sorted routes based on category + filter */
  const displayRoutes = useMemo(() => {
    let list = [...routes];

    // Filter chip
    if (selectedFilter) {
      const keywords = FILTER_TAG_MATCH[selectedFilter];
      list = list.filter(r =>
        r.tags.some(tag => keywords.some(kw => tag.includes(kw))),
      );
    }

    // Category sort/filter
    switch (selectedCategory) {
      case 'verified':
        // Show all, verified = copy_count >= 100, sorted by newest (keep original order)
        break;
      case 'hot':
        list.sort((a, b) => b.copy_count - a.copy_count);
        break;
      case 'bestSellers':
        list.sort((a, b) => b.copy_count - a.copy_count);
        break;
      case 'budget':
        list.sort((a, b) => a.budget.amount - b.budget.amount);
        break;
    }
    return list;
  }, [routes, selectedCategory, selectedFilter]);

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
    } catch {
      // Still show modal with leg info even if API fails
      setPlaceDetail({
        name: leg.place.name,
        description: '',
        image_url: null,
        wiki_url: null,
        map_url: leg.place.latitude && leg.place.longitude
          ? `https://www.google.com/maps/search/?api=1&query=${leg.place.latitude},${leg.place.longitude}`
          : null,
      });
    }
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
      id: `community-${r.destination}-${r.total_hours}h`,
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
        _findPresetDetail(id);
      }
    } else {
      // Try API first even in preset mode for real legs/map data
      try {
        const detail = await fetchCommunityRouteDetail(id);
        setExpandedRouteDetail(detail);
      } catch {
        _findPresetDetail(id);
      }
    }
  }, [expandedId, dataSource]);

  /** Find preset route by community-style ID or original ID */
  const _findPresetDetail = (id: string) => {
    // Match by community-style ID: "community-{destination}-{hours}h"
    const preset = PRESET_ROUTES.find(r =>
      `community-${r.destination}-${r.total_hours}h` === id || r.id === id,
    );
    if (preset) setExpandedRouteDetail(preset);
  };

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
            t('guides.copySuccess'),
            `${result.copy_count} ${t('guides.saves', { count: result.copy_count })}`,
            [
              { text: t('plan.cancel'), style: 'cancel' },
              {
                text: t('guides.navigate'),
                onPress: () => Linking.openURL(result.route.map!.google_maps_deeplink),
              },
            ],
          );
        } else {
          Alert.alert(t('guides.copySuccess'), `${result.copy_count} ${t('guides.saves', { count: result.copy_count })}`);
        }
      }
    } catch {
      Alert.alert(t('guides.copyFail'), t('guides.copyFail'));
    } finally {
      setCopyingId(null);
    }
  }, []);

  const handleSaveRoute = useCallback(async (route: CommunityRoute | CommunityRouteCard) => {
    try {
      const deviceId = (await AsyncStorage.getItem('device_id')) || '';
      if (!deviceId) {
        setToastMessage(t('common.error'));
        return;
      }
      const stops = 'legs' in route && Array.isArray(route.legs) ? route.legs.length : 0;
      const resp = await saveItinerary({
        device_id: deviceId,
        itinerary_id: route.id,
        title: route.title,
        destination: route.destination,
        stops,
        days: Math.max(1, Math.round(route.total_hours / 24)),
        cover_image: route.cover_image || getDestinationImage(route.destination, 800, 400),
      });
      if (resp.success) {
        setToastMessage(t('profile.savedToast'));
      } else {
        setToastMessage(resp.message || t('profile.saveFail'));
      }
    } catch {
      setToastMessage(t('profile.saveFail'));
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{t('guides.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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
        {/* 头部 — Stitch 粘性标题栏 + 分类 Tabs */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{t('guides.title')}</Text>
            {dataSource === 'api' && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{t('guides.live')} · {routes.length}</Text>
              </View>
            )}
          </View>
          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catTabRow}>
            {([
              { key: 'verified' as CategoryTab, label: t('guides.verified') },
              { key: 'hot' as CategoryTab, label: t('guides.hot') },
              { key: 'bestSellers' as CategoryTab, label: t('guides.bestSellers') },
              { key: 'budget' as CategoryTab, label: t('guides.budget') },
            ]).map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={styles.catTab}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(tab.key)}>
                <Text style={[styles.catTabText, selectedCategory === tab.key && styles.catTabTextActive]}>
                  {tab.label}
                </Text>
                {selectedCategory === tab.key && <View style={styles.catTabBar} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Quick Filter Tags */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          {([
            { key: 'budget' as FilterTag, icon: 'cash-outline', label: t('guides.filterBudget') },
            { key: 'foodie' as FilterTag, icon: 'restaurant-outline', label: t('guides.filterFoodie') },
            { key: 'hiking' as FilterTag, icon: 'walk-outline', label: t('guides.filterHiking') },
            { key: 'photo' as FilterTag, icon: 'camera-outline', label: t('guides.filterPhoto') },
          ]).map((f) => {
            const isActive = selectedFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                activeOpacity={0.7}
                onPress={() => setSelectedFilter(prev => prev === f.key ? null : f.key)}>
                <Ionicons name={f.icon as any} size={14} color={isActive ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 路线卡片 */}
        {displayRoutes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={36} color={Colors.textLight} />
            <Text style={styles.emptyText}>{t('guides.noResults')}</Text>
            <TouchableOpacity onPress={() => { setSelectedFilter(null); setSelectedCategory('hot'); }}>
              <Text style={styles.emptyReset}>{t('guides.resetFilter')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          displayRoutes.map(route => (
            <RouteCard
              key={route.id}
              route={route}
              expanded={expandedId === route.id}
              detail={expandedId === route.id ? expandedRouteDetail : null}
              copying={copyingId === route.id}
              onToggle={() => toggleExpand(route.id)}
              onCopy={() => handleCopy(route.id)}
              onSave={handleSaveRoute}
              onPressPlace={handlePressPlace}
            />
          ))
        )}

        {/* 底部说明 */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('guides.dataFromPreset')}
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
                  <Text style={styles.modalLoadingText}>{t('guides.placeDetailLoading')}</Text>
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
                      <Text style={styles.modalSectionTitle}>Description</Text>
                      <Text style={styles.modalDesc}>{placeDetail.description}</Text>
                    </View>
                  ) : null}

                  {selectedLeg.tips && selectedLeg.tips.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>Travel Tips</Text>
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

      {!!toastMessage && (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={styles.toastCard}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function RouteCard({
  route,
  expanded,
  detail,
  copying,
  onToggle,
  onCopy,
  onSave,
  onPressPlace,
}: {
  route: CommunityRouteCard;
  expanded: boolean;
  detail: CommunityRoute | null;
  copying: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onSave: (route: CommunityRoute | CommunityRouteCard) => void;
  onPressPlace: (leg: ItineraryLeg) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const imageUri = imgError
    ? 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=280&fit=crop&auto=format&q=80'
    : getDestinationImage(route.destination || route.title, 600, 280);
  return (
    <View style={styles.card}>
      {/* Cover image + gradient overlay */}
      <View style={styles.cardCover}>
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.45)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>
            {route.copy_count >= 400 ? 'HOT' : route.copy_count >= 200 ? 'BEST SELLER' : 'VERIFIED'}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
          <View style={styles.cardTop}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{route.title}</Text>
              <Ionicons name="heart-outline" size={20} color={Colors.textLight} />
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
                <Text style={styles.metaItemText}>{route.total_hours}H</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="cash-outline" size={12} color={Colors.textSecondary} />
                <Text style={styles.metaItemText}>{formatMoneyWithCode(route.budget)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="bookmark-outline" size={12} color={Colors.textSecondary} />
                <Text style={styles.metaItemText}>{t('guides.saves', { count: route.copy_count })}</Text>
              </View>
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
              {expanded ? t('guides.hideDetails') : t('guides.viewDetails')}
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
                <Text style={styles.detailLoadingText}>{t('common.loading')}</Text>
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

                {/* Stitch 操作按钮 */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.copyBtn, copying && styles.copyBtnDisabled]}
                    activeOpacity={0.85}
                    onPress={onCopy}
                    disabled={copying}>
                    {copying ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="copy-outline" size={15} color={Colors.primary} />
                        <Text style={styles.copyBtnText}>{t('guides.copyItinerary')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    activeOpacity={0.85}
                    onPress={() => detail && onSave(detail)}
                    disabled={!detail}>
                    <Ionicons name="bookmark-outline" size={15} color={Colors.primary} />
                    <Text style={styles.saveBtnText}>{t('profile.saveItinerary')}</Text>
                  </TouchableOpacity>
                  {detail.map?.google_maps_deeplink ? (
                    <TouchableOpacity
                      style={styles.navBtn}
                      activeOpacity={0.7}
                      onPress={() => Linking.openURL(detail.map!.google_maps_deeplink)}>
                      <Ionicons name="navigate-outline" size={15} color="#fff" />
                      <Text style={styles.navBtnText}>{t('guides.navigate')}</Text>
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

function LegRow({ leg, isLast, onPressPlace }: { leg: ItineraryLeg; isLast: boolean; onPressPlace: (leg: ItineraryLeg) => void }) {
  const startTime = leg.start_time_local.slice(11, 16);
  const iconInfo = ACTIVITY_ICON_MAP[leg.activity_type] || {
    name: 'location',
    color: Colors.primary,
  };

  return (
    <View style={styles.legRow}>
      {/* Stitch 时间轴 — dot + ring */}
      <View style={styles.legRail}>
        <View style={[styles.legDotRing, { borderColor: `${iconInfo.color}30` }]}>
          <View style={[styles.legDot, { backgroundColor: iconInfo.color }]} />
        </View>
        {!isLast && <View style={styles.legLine} />}
      </View>
      {/* 信息 */}
      <View style={[styles.legInfo, isLast && { paddingBottom: 0 }]}>
        <View style={styles.legTimeRow}>
          <Text style={styles.legTime}>{startTime}</Text>
        </View>
        <View style={styles.legMain}>
          <TouchableOpacity onPress={() => onPressPlace(leg)} activeOpacity={0.7} style={styles.legNameRow}>
            <Text style={styles.legName}>{leg.place.name}</Text>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textLight} />
          </TouchableOpacity>
          <Text style={styles.legCost}>{formatMoney(leg.estimated_cost, true)}</Text>
        </View>
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
    paddingBottom: 120,
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

  // ── Header — Stitch sticky
  header: {
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.tagActive.border,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.tagActive.bg,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  liveText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },

  // ── Category Tabs — Stitch underline style
  catTabRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  catTab: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  catTabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textLight,
  },
  catTabTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  catTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },

  // ── Quick Filters — Stitch pill chips
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    height: 36,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceElevated,
  },
  filterChipActive: {
    backgroundColor: Colors.tagActive.bg,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
  },
  filterChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.primary,
  },

  // ── Card — Stitch rounded-xl with cover
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardCover: {
    width: '100%',
    height: 180,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: Spacing.md,
    overflow: 'hidden',
  },
  cardBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  cardBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardBody: {
    flex: 1,
  },
  cardTop: {
    padding: Spacing.lg,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    lineHeight: 24,
    flex: 1,
    marginRight: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItemText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  tagRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: Colors.tagActive.bg,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
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

  // ── Timeline — Stitch dot + ring
  legRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  legRail: {
    width: 28,
    alignItems: 'center',
  },
  legDotRing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    backgroundColor: Colors.surface,
  },
  legDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.tagActive.border,
    marginVertical: 2,
  },
  legInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  legTimeRow: {
    marginBottom: 2,
  },
  legMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legName: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: FontWeight.bold,
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
    fontWeight: FontWeight.bold,
  },

  // ── Actions — Stitch Copy + Navigate
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
    backgroundColor: Colors.tagActive.bg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    gap: Spacing.xs,
  },
  copyBtnDisabled: {
    opacity: 0.6,
  },
  copyBtnText: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    gap: Spacing.xs,
  },
  saveBtnText: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.xs,
  },
  navBtnText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
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

  // ── Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.hero,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  emptyReset: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // ── Timezone Banner
  tzBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.tagActive.bg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
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

  // ── Place Detail Modal — Stitch
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    borderRadius: BorderRadius.xl,
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
    backgroundColor: Colors.tagActive.bg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  modalActionTextSecondary: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },

  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.xxl,
    alignItems: 'center',
  },
  toastCard: {
    backgroundColor: Colors.text,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    ...Shadow.sm,
  },
  toastText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
