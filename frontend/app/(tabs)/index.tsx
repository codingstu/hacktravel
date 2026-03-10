/**
 * Tab1 极限爆改 — 行程生成主界面（v3 杂志风重构）
 *
 * 设计语言：
 * - 大标题 hero 区 + 奶油白输入卡片 + 暗色结果卡
 * - 去掉 emoji 做标题，改用 icon + 纯文字
 * - 时间轴用色块渐变替代圆点线条
 * - 加载态用个性文案替代通用 spinner 文字
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Modal,
  Image,
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  DEFAULT_CONTINENT,
  inferContinentFromCoordinates,
  inferContinentFromTimezone,
} from '@/services/region';
import {
  Colors,
  Spacing,
  FontSize,
  FontWeight,
  BorderRadius,
  Shadow,
} from '@/constants/Theme';
import {
  generateItinerary,
  ApiError,
  fetchPlaceDetail,
  fetchRegionMetadata,
} from '@/services/api';
import {
  TRAVEL_TAGS,
  CONTINENT_OPTIONS,
  FEATURED_SUB_REGIONS_FALLBACK,
  REGION_METADATA_FALLBACK,
  PRESET_ROUTES,
  HOT_DESTINATIONS,
} from '@/services/presets';
import { formatMoney, formatMoneyWithCode, getTimezoneLabel } from '@/utils/format';
import type {
  Continent,
  FeaturedSubRegion,
  ItineraryGenerateResponse,
  ItineraryLeg,
  CommunityRoute,
  PlaceDetailResponse,
  RegionMeta,
} from '@/services/types';

type ViewState = 'idle' | 'loading' | 'success' | 'error';

/** 将 ApiError 转换为用户友好的中文提示 */
function friendlyApiError(err: ApiError): string {
  switch (err.code) {
    case 'HKT_429_RATE_LIMITED':
      return err.retryAfter
        ? `请求太频繁，请 ${err.retryAfter} 秒后重试`
        : '请求太频繁，请稍后重试';
    case 'HKT_503_MODEL_UNAVAILABLE':
      return 'AI 服务暂时不可用，请稍后重试';
    case 'HKT_504_MODEL_TIMEOUT':
      return 'AI 生成超时，请重试';
    case 'HKT_599_FALLBACK_CACHE_MISS':
      return '所有 AI 模型均不可用，请稍后重试';
    case 'HKT_400_INVALID_INPUT':
      return `输入有误：${err.message}`;
    case 'HKT_422_SCHEMA_VALIDATION_FAILED':
      return '参数格式错误，请检查输入';
    default:
      return err.message || '未知错误，请稍后重试';
  }
}

/** 活动类型 → Ionicons 图标映射（替代 emoji） */
const ACTIVITY_ICON_MAP: Record<string, { name: string; color: string }> = {
  food: { name: 'restaurant', color: '#E88A3A' },
  transit: { name: 'bus', color: '#5B8DEF' },
  attraction: { name: 'camera', color: '#A96FDB' },
  rest: { name: 'bed', color: '#6BC5A0' },
  shopping: { name: 'bag-handle', color: '#E86B8A' },
  flight: { name: 'airplane', color: '#5B8DEF' },
};

/** 随机加载文案 — 仅在 AI 生成时展示 */
const LOADING_QUIPS = [
  '未找到内置路线，AI 正在专属定制中…',
  '正在翻遍全网找最便宜的机票…',
  '疯狂计算怎么用最少的钱吃到最多美食…',
  '帮你跟本地人打听哪条巷子值得钻…',
  '把每一分钟都安排得明明白白…',
  '在地图上画出一条完美路线…',
];

export default function GenerateScreen() {
  // ── Form ──
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [hours, setHours] = useState('48');
  const [budget, setBudget] = useState('3000');
  const [selectedTags, setSelectedTags] = useState<string[]>(['疯狂暴走']);
  const [selectedContinent, setSelectedContinent] = useState<Continent>(DEFAULT_CONTINENT);
  const [selectedSubRegion, setSelectedSubRegion] = useState<string>('');
  const [regionMeta, setRegionMeta] = useState<RegionMeta[]>(REGION_METADATA_FALLBACK);
  const [featuredSubRegions, setFeaturedSubRegions] = useState<FeaturedSubRegion[]>(FEATURED_SUB_REGIONS_FALLBACK);
  const [regionLoading, setRegionLoading] = useState(true);

  const activeRegion = useMemo(
    () => regionMeta.find(region => region.key === selectedContinent) ?? null,
    [regionMeta, selectedContinent],
  );

  const activeSubRegions = useMemo(
    () => activeRegion?.sub_regions ?? [],
    [activeRegion],
  );

  const filteredHotDestinations = useMemo(() => {
    if (selectedSubRegion) {
      const subRegionMeta = featuredSubRegions.find(item => item.key === selectedSubRegion);
      if (subRegionMeta?.hot_destinations?.length) {
        return subRegionMeta.hot_destinations;
      }
    }
    if (activeRegion?.hot_destinations?.length) {
      return activeRegion.hot_destinations;
    }
    return HOT_DESTINATIONS;
  }, [activeRegion, featuredSubRegions, selectedSubRegion]);

  const filteredPresetRoutes = useMemo(
    () => PRESET_ROUTES.filter(route => {
      if (route.continent !== selectedContinent) return false;
      if (selectedSubRegion && route.sub_region !== selectedSubRegion) return false;
      return true;
    }),
    [selectedContinent, selectedSubRegion],
  );

  // ── Result ──
  const [viewState, setViewState] = useState<ViewState>('idle');
  const [result, setResult] = useState<ItineraryGenerateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingQuip, setLoadingQuip] = useState('');

  // ── 可编辑时间轴 ──
  const [editableLegs, setEditableLegs] = useState<ItineraryLeg[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddLeg, setShowAddLeg] = useState(false);
  const [newLegName, setNewLegName] = useState('');
  const [newLegCost, setNewLegCost] = useState('0');
  const [newLegType, setNewLegType] = useState<string>('attraction');

  const scrollRef = useRef<ScrollView>(null);

  // ── 地点详情 Modal ──
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
      // Still show modal with leg info even if Wikipedia fails
      setPlaceDetail({
        name: leg.place.name,
        description: '',
        image_url: null,
        wiki_url: null,
        map_url: leg.place.latitude && leg.place.longitude
          ? `https://www.google.com/maps/search/?api=1&query=${leg.place.latitude},${leg.place.longitude}`
          : null,
      });
    } finally {
      setPlaceDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const bootstrapRegion = async () => {
      try {
        const metadata = await fetchRegionMetadata();
        setRegionMeta(metadata.continents);
        setFeaturedSubRegions(metadata.featured_sub_regions);
      } catch {
        setRegionMeta(REGION_METADATA_FALLBACK);
        setFeaturedSubRegions(FEATURED_SUB_REGIONS_FALLBACK);
      } finally {
        setRegionLoading(false);
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let inferredContinent = inferContinentFromTimezone(timezone);
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          inferredContinent = inferContinentFromCoordinates(
            current.coords.latitude,
            current.coords.longitude,
          );
        }
      } catch {
        inferredContinent = inferContinentFromTimezone(timezone);
      }
      setSelectedContinent(inferredContinent);
    };

    bootstrapRegion();
  }, []);

  useEffect(() => {
    setSelectedSubRegion('');
  }, [selectedContinent]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!destination.trim()) {
      setErrorMsg('请输入目的地');
      setViewState('error');
      return;
    }
    setViewState('loading');
    setErrorMsg('');
    setLoadingQuip(
      LOADING_QUIPS[Math.floor(Math.random() * LOADING_QUIPS.length)],
    );

    try {
      const resp = await generateItinerary({
        origin: origin.trim() || '出发地',
        destination: destination.trim(),
        total_hours: parseInt(hours, 10) || 48,
        budget: {
          amount: parseInt(budget, 10) || 3000,
          currency: 'CNY',
        },
        tags: selectedTags,
        continent: selectedContinent,
        sub_region: selectedSubRegion || undefined,
      });
      setResult(resp);
      setEditableLegs(resp.legs);
      setIsEditing(false);
      setShowAddLeg(false);
      setViewState('success');
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 400, animated: true });
      }, 300);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(friendlyApiError(err));
      } else if (err instanceof Error) {
        setErrorMsg(err.name === 'AbortError' ? '请求超时，请重试' : err.message);
      } else {
        setErrorMsg('未知错误，请稍后重试');
      }
      setViewState('error');
    }
  }, [origin, destination, hours, budget, selectedContinent, selectedSubRegion, selectedTags]);

  const handleOpenMaps = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  // ── 编辑时间轴操作 ──
  const moveLegUp = useCallback((i: number) => {
    setEditableLegs(prev => {
      if (i === 0) return prev;
      const arr = [...prev];
      [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
      return arr.map((l, idx) => ({ ...l, index: idx }));
    });
  }, []);

  const moveLegDown = useCallback((i: number) => {
    setEditableLegs(prev => {
      if (i >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      return arr.map((l, idx) => ({ ...l, index: idx }));
    });
  }, []);

  const deleteLeg = useCallback((i: number) => {
    Alert.alert('删除节点', `确认删除「${editableLegs[i]?.place.name}」?`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: () =>
          setEditableLegs(prev =>
            prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, index: idx }))
          ),
      },
    ]);
  }, [editableLegs]);

  const addLeg = useCallback(() => {
    if (!newLegName.trim()) return;
    const newLeg: ItineraryLeg = {
      index: editableLegs.length,
      start_time_local: '2026-01-01T12:00:00',
      end_time_local: '2026-01-01T14:00:00',
      activity_type: newLegType as any,
      place: { name: newLegName.trim() },
      estimated_cost: { amount: parseInt(newLegCost, 10) || 0, currency: 'CNY' },
      tips: [],
    };
    setEditableLegs(prev => [...prev, newLeg]);
    setNewLegName('');
    setNewLegCost('0');
    setShowAddLeg(false);
  }, [editableLegs.length, newLegName, newLegCost, newLegType]);

  // ── 强制 AI 重新规划 ──
  const handleForceAI = useCallback(async () => {
    if (!destination.trim()) return;
    setViewState('loading');
    setIsEditing(false);
    setErrorMsg('');
    setLoadingQuip('AI 正在专属定制，逐分每颗钱都安排上…');
    try {
      const resp = await generateItinerary({
        origin: origin.trim() || '出发地',
        destination: destination.trim(),
        total_hours: parseInt(hours, 10) || 48,
        budget: { amount: parseInt(budget, 10) || 3000, currency: 'CNY' },
        tags: selectedTags,
        continent: selectedContinent,
        sub_region: selectedSubRegion || undefined,
        skip_preset: true,
      });
      setResult(resp);
      setEditableLegs(resp.legs);
      setShowAddLeg(false);
      setViewState('success');
      setTimeout(() => scrollRef.current?.scrollTo({ y: 400, animated: true }), 300);
    } catch (err) {
      if (err instanceof ApiError) setErrorMsg(`${err.code}: ${err.message}`);
      else if (err instanceof Error)
        setErrorMsg(err.name === 'AbortError' ? '请求超时，请重试' : err.message);
      else setErrorMsg('未知错误，请稍后重试');
      setViewState('error');
    }
  }, [origin, destination, hours, budget, selectedContinent, selectedSubRegion, selectedTags]);

  const fillPreset = useCallback((route: CommunityRoute) => {
    setDestination(route.destination);
    setHours(route.total_hours.toString());
    setBudget(route.budget.amount.toString());
    setSelectedTags(route.tags);
    if (route.continent) setSelectedContinent(route.continent);
    setSelectedSubRegion(route.sub_region ?? '');
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ── Hero 头部 ── */}
        <LinearGradient
          colors={[Colors.gradient.heroStart, Colors.gradient.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBrand}>
              <Ionicons name="paper-plane" size={14} color={Colors.accent} />
              <Text style={styles.heroBrandText}>HackTravel Dispatch</Text>
            </View>
            <View style={styles.heroMenu}>
              <Ionicons name="menu" size={18} color={Colors.text} />
            </View>
          </View>
          <Text style={styles.heroTitle}>Plan Smart{'\n'}Travel Better</Text>
          <Text style={styles.heroSub}>
            输入目的地，快速生成舒适、可执行、可编辑的完整行程
          </Text>
          <View style={styles.heroStatsRow}>
            <HeroMetric label="时长" value={`${hours || '48'}h`} icon="time-outline" />
            <HeroMetric
              label="预算"
              value={`¥${(parseInt(budget, 10) || 3000).toLocaleString()}`}
              icon="wallet-outline"
            />
            <HeroMetric label="区域" value={selectedContinent.toUpperCase()} icon="earth-outline" />
          </View>
        </LinearGradient>

        {/* ── 输入区 ── */}
        <View style={styles.formCard}>
          {/* 出发地 → 目的地 */}
          <View style={styles.routeRow}>
            <View style={styles.routeInput}>
              <Text style={styles.fieldLabel}>FROM</Text>
              <TextInput
                style={styles.input}
                value={origin}
                onChangeText={setOrigin}
                placeholder="上海"
                placeholderTextColor={Colors.textLight}
              />
            </View>
            <View style={styles.routeArrow}>
              <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
            </View>
            <View style={styles.routeInput}>
              <Text style={styles.fieldLabel}>TO</Text>
              <TextInput
                style={[styles.input, styles.inputHighlight]}
                value={destination}
                onChangeText={setDestination}
                placeholder="冲绳"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>

          {/* 大洲开关 */}
          <Text style={styles.fieldLabel}>CONTINENT</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hotScroll}
            contentContainerStyle={styles.hotContent}>
            {CONTINENT_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.hotChip,
                  selectedContinent === option.key && styles.hotChipActive,
                ]}
                onPress={() => setSelectedContinent(option.key)}>
                <Text
                  style={[
                    styles.hotChipText,
                    selectedContinent === option.key && styles.hotChipTextActive,
                  ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {activeSubRegions.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>FOCUS REGION</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.hotScroll}
                contentContainerStyle={styles.hotContent}>
                <TouchableOpacity
                  style={[styles.hotChip, !selectedSubRegion && styles.hotChipActive]}
                  onPress={() => setSelectedSubRegion('')}>
                  <Text style={[styles.hotChipText, !selectedSubRegion && styles.hotChipTextActive]}>
                    全部
                  </Text>
                </TouchableOpacity>
                {activeSubRegions.map(region => (
                  <TouchableOpacity
                    key={region.key}
                    style={[
                      styles.hotChip,
                      selectedSubRegion === region.key && styles.hotChipActive,
                    ]}
                    onPress={() => setSelectedSubRegion(region.key)}>
                    <Text
                      style={[
                        styles.hotChipText,
                        selectedSubRegion === region.key && styles.hotChipTextActive,
                      ]}>
                      {region.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* 热门目的地 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hotScroll}
            contentContainerStyle={styles.hotContent}>
            {filteredHotDestinations.map((dest: string) => (
              <TouchableOpacity
                key={dest}
                style={[
                  styles.hotChip,
                  destination === dest && styles.hotChipActive,
                ]}
                onPress={() => setDestination(dest)}>
                <Text
                  style={[
                    styles.hotChipText,
                    destination === dest && styles.hotChipTextActive,
                  ]}>
                  {dest}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {regionLoading && (
            <Text style={styles.loadingQuip}>正在识别你所在的大洲并加载全球热门路线…</Text>
          )}

          {/* DURATION & BUDGET */}
          <View style={styles.paramRow}>
            <View style={styles.paramItem}>
              <Text style={styles.fieldLabel}>DURATION</Text>
              <View style={styles.paramInputWrap}>
                <TextInput
                  style={styles.paramInput}
                  value={hours}
                  onChangeText={setHours}
                  keyboardType="number-pad"
                  placeholder="48"
                  placeholderTextColor={Colors.textLight}
                />
                <Text style={styles.paramUnit}>hrs</Text>
              </View>
            </View>
            <View style={styles.paramDivider} />
            <View style={styles.paramItem}>
              <Text style={styles.fieldLabel}>BUDGET</Text>
              <View style={styles.paramInputWrap}>
                <Text style={styles.paramPrefix}>¥</Text>
                <TextInput
                  style={styles.paramInput}
                  value={budget}
                  onChangeText={setBudget}
                  keyboardType="number-pad"
                  placeholder="3000"
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>
          </View>

          {/* PREFERENCES标签 */}
          <Text style={styles.fieldLabel}>PREFERENCES</Text>
          <View style={styles.tagWrap}>
            {TRAVEL_TAGS.map(tag => (
              <TouchableOpacity
                key={tag.key}
                style={[
                  styles.tagChip,
                  selectedTags.includes(tag.key) && styles.tagChipActive,
                ]}
                onPress={() => toggleTag(tag.key)}>
                <Text
                  style={[
                    styles.tagText,
                    selectedTags.includes(tag.key) && styles.tagTextActive,
                  ]}>
                  {tag.key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.ctaBtn, viewState === 'loading' && styles.ctaBtnLoading]}
            onPress={handleGenerate}
            disabled={viewState === 'loading'}
            activeOpacity={0.85}>
            {viewState === 'loading' ? (
              <ActivityIndicator color={Colors.accent} size="small" />
            ) : (
              <>
                <Ionicons name="flash" size={18} color={Colors.accent} />
                <Text style={styles.ctaBtnText}>Plan My Trip</Text>
              </>
            )}
          </TouchableOpacity>

          {viewState === 'loading' && (
            <Text style={styles.loadingQuip}>{loadingQuip}</Text>
          )}
        </View>

        {/* ── 错误态 ── */}
        {viewState === 'error' && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={28} color={Colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleGenerate}>
              <Text style={styles.retryBtnText}>重新规划</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 结果区 ── */}
        {viewState === 'success' && result && (
          <View style={styles.resultArea}>
            {/* 汇总卡 */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{result.title}</Text>
              <View style={styles.summaryRow}>
                <SummaryPill
                  label="总DURATION"
                  value={`${result.summary.total_hours}h`}
                />
                <SummaryPill
                  label="预计花费"
                  value={formatMoney(result.summary.estimated_total_cost)}
                  sub={result.summary.estimated_total_cost.currency}
                />
                <SummaryPill
                  label="节点"
                  value={`${editableLegs.length}`}
                />
              </View>
              {result.source.is_preset && (
                <View style={styles.presetBadge}>
                  <Ionicons name="flash" size={12} color={Colors.primary} />
                  <Text style={styles.presetBadgeText}>闪电推荐</Text>
                </View>
              )}
              {result.source.cache_hit && !result.source.is_preset && (
                <View style={styles.cacheBadge}>
                  <Ionicons name="flash" size={12} color={Colors.success} />
                  <Text style={styles.cacheBadgeText}>极速缓存</Text>
                </View>
              )}
              {!result.source.cache_hit && !result.source.is_preset && (
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={12} color={Colors.primary} />
                  <Text style={styles.aiBadgeText}>AI 定制</Text>
                </View>
              )}
            </View>

            {/* BUDGET警告 */}
            {(() => {
              const estimated = result.summary.estimated_total_cost.amount;
              const userBudget = parseInt(budget, 10) || 0;
              if (userBudget > 0 && estimated > userBudget * 1.2) {
                return (
                  <View style={styles.budgetWarnBanner}>
                    <Ionicons name="warning" size={16} color="#92400E" />
                    <Text style={styles.budgetWarnText}>
                      预置路线预估 ¥{estimated} CNY，超出你的预算 ¥{userBudget} CNY，
                      可手动删除节点或用 AI 重新规划
                    </Text>
                  </View>
                );
              }
              return null;
            })()}

            {/* 操作栏：编辑 + AI 重新规划 */}
            <View style={styles.resultActions}>
              <TouchableOpacity
                style={[styles.actionBtn, isEditing && styles.actionBtnActive]}
                onPress={() => { setIsEditing(v => !v); setShowAddLeg(false); }}>
                <Ionicons
                  name={isEditing ? 'checkmark-circle' : 'create-outline'}
                  size={16}
                  color={isEditing ? '#fff' : Colors.primary}
                />
                <Text style={[styles.actionBtnText, isEditing && styles.actionBtnTextActive]}>
                  {isEditing ? '完成编辑' : '编辑路线'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={handleForceAI}>
                <Ionicons name="sparkles" size={16} color={Colors.accent} />
                <Text style={styles.actionBtnSecondaryText}>AI 重新规划</Text>
              </TouchableOpacity>
            </View>

            {/* 时间轴 */}
            <View style={styles.timeline}>
              {/* 时区提示（跨时区路线） */}
              {(() => {
                const tzLabel = getTimezoneLabel(destination);
                if (tzLabel) {
                  return (
                    <View style={styles.timezoneBanner}>
                      <Ionicons name="time-outline" size={14} color={Colors.primary} />
                      <Text style={styles.timezoneText}>
                        以下时间均为目的地{tzLabel}
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}
              {editableLegs.map((leg, i) => (
                <TimelineLeg
                  key={`${i}-${leg.place.name}`}
                  leg={leg}
                  index={i}
                  isLast={i === editableLegs.length - 1}
                  isEditing={isEditing}
                  canMoveUp={i > 0}
                  canMoveDown={i < editableLegs.length - 1}
                  onMoveUp={() => moveLegUp(i)}
                  onMoveDown={() => moveLegDown(i)}
                  onDelete={() => deleteLeg(i)}
                  onPressPlace={() => handlePressPlace(leg)}
                />
              ))}
            </View>

            {/* 添加途经点 */}
            {isEditing && (
              <View style={styles.addLegSection}>
                {!showAddLeg ? (
                  <TouchableOpacity
                    style={styles.addLegBtn}
                    onPress={() => setShowAddLeg(true)}>
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                    <Text style={styles.addLegBtnText}>添加途经点</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.addLegForm}>
                    <Text style={styles.addLegFormTitle}>新增途经点</Text>
                    <TextInput
                      style={styles.addLegInput}
                      value={newLegName}
                      onChangeText={setNewLegName}
                      placeholder="地点名称（如：筑地市场）"
                      placeholderTextColor={Colors.textLight}
                    />
                    <View style={styles.addLegRow}>
                      <View style={styles.addLegCostWrap}>
                        <Text style={styles.addLegLabel}>预计花费 ¥</Text>
                        <TextInput
                          style={styles.addLegCostInput}
                          value={newLegCost}
                          onChangeText={setNewLegCost}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={Colors.textLight}
                        />
                      </View>
                    </View>
                    {/* 活动类型选择 */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: Spacing.md }}>
                      {[
                        { key: 'attraction', label: '景点' },
                        { key: 'food', label: '美食' },
                        { key: 'transit', label: '交通' },
                        { key: 'shopping', label: '购物' },
                        { key: 'rest', label: '住宿' },
                        { key: 'flight', label: '航班' },
                      ].map(t => (
                        <TouchableOpacity
                          key={t.key}
                          style={[
                            styles.typeChip,
                            newLegType === t.key && styles.typeChipActive,
                          ]}
                          onPress={() => setNewLegType(t.key)}>
                          <Text
                            style={[
                              styles.typeChipText,
                              newLegType === t.key && styles.typeChipTextActive,
                            ]}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={styles.addLegFormBtns}>
                      <TouchableOpacity
                        style={styles.addLegConfirm}
                        onPress={addLeg}>
                        <Text style={styles.addLegConfirmText}>确认添加</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.addLegCancel}
                        onPress={() => setShowAddLeg(false)}>
                        <Text style={styles.addLegCancelText}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* 导航 CTA */}
            <TouchableOpacity
              style={styles.mapsBtn}
              onPress={() => handleOpenMaps(result.map.google_maps_deeplink)}
              activeOpacity={0.85}>
              <Ionicons name="navigate" size={20} color={Colors.accent} />
              <Text style={styles.mapsBtnText}>
                导入 Google Maps · {result.map.waypoints_count} 个途经点
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 空态：推荐路线 ── */}
        {viewState === 'idle' && (
          <View style={styles.presetArea}>
            <Text style={styles.sectionLabel}>热门路线</Text>
            <Text style={styles.sectionDesc}>
              {activeRegion ? `${activeRegion.label} 热门路线优先展示` : '对应目的地可秒出路线，点击自动填入参数'}
            </Text>
            {filteredPresetRoutes.map(route => (
              <TouchableOpacity
                key={route.id}
                style={styles.presetCard}
                onPress={() => fillPreset(route)}
                activeOpacity={0.7}>
                <View style={styles.presetHeader}>
                  <Text style={styles.presetTitle}>{route.title}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.textLight}
                  />
                </View>
                <View style={styles.presetMeta}>
                  <Text style={styles.presetChip}>{route.total_hours}H</Text>
                  <Text style={styles.presetChip}>{formatMoneyWithCode(route.budget)}</Text>
                  <Text style={styles.presetChip}>
                    {route.copy_count} 人抄过
                  </Text>
                  {route.sub_region ? (
                    <Text style={styles.presetChip}>{route.sub_region}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── 地点详情 Modal ── */}
      <Modal
        visible={placeModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPlaceModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* 关闭按钮 */}
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
                {/* 地点图片 */}
                {placeDetail?.image_url && (
                  <Image
                    source={{ uri: placeDetail.image_url }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                )}

                {/* 地点名称 + 类型 */}
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

                {/* 交通信息 */}
                {selectedLeg.transport && (
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="car-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.modalInfoText}>
                      {selectedLeg.transport.mode}
                      {selectedLeg.transport.reference ? ` · ${selectedLeg.transport.reference}` : ''}
                    </Text>
                  </View>
                )}

                {/* Wikipedia 简介 */}
                {placeDetail?.description ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>简介</Text>
                    <Text style={styles.modalDesc}>{placeDetail.description}</Text>
                  </View>
                ) : null}

                {/* Insider Tips / 热门评价 */}
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

                {/* 坐标 */}
                {selectedLeg.place.latitude != null && selectedLeg.place.longitude != null && (
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.modalInfoText}>
                      {selectedLeg.place.latitude.toFixed(4)}, {selectedLeg.place.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}

                {/* 操作按钮 */}
                <View style={styles.modalActions}>
                  {placeDetail?.map_url && (
                    <TouchableOpacity
                      style={styles.modalActionBtn}
                      onPress={() => Linking.openURL(placeDetail.map_url!)}>
                      <Ionicons name="navigate" size={16} color="#fff" />
                      <Text style={styles.modalActionText}>在 Google Maps 中查看</Text>
                    </TouchableOpacity>
                  )}
                  {placeDetail?.wiki_url && (
                    <TouchableOpacity
                      style={styles.modalActionBtnSecondary}
                      onPress={() => Linking.openURL(placeDetail.wiki_url!)}>
                      <Ionicons name="book-outline" size={16} color={Colors.primary} />
                      <Text style={styles.modalActionTextSecondary}>Wikipedia 详情</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

/* ─── 子组件 ─── */

function SummaryPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.summaryPill}>
      <View style={styles.summaryPillValueRow}>
        <Text style={styles.summaryPillValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        {sub ? <Text style={styles.summaryPillSub}>{sub}</Text> : null}
      </View>
      <Text style={styles.summaryPillLabel}>{label}</Text>
    </View>
  );
}

function HeroMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.heroMetric}>
      <Ionicons name={icon} size={12} color={Colors.accent} />
      <Text style={styles.heroMetricLabel}>{label}</Text>
      <Text style={styles.heroMetricValue}>{value}</Text>
    </View>
  );
}

function TimelineLeg({
  leg,
  index,
  isLast,
  isEditing = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onDelete,
  onPressPlace,
}: {
  leg: ItineraryLeg;
  index: number;
  isLast: boolean;
  isEditing?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  onPressPlace?: () => void;
}) {
  const startTime = leg.start_time_local.slice(11, 16);
  const endTime = leg.end_time_local.slice(11, 16);
  const iconInfo = ACTIVITY_ICON_MAP[leg.activity_type] || {
    name: 'location',
    color: Colors.primary,
  };

  return (
    <View style={styles.legRow}>
      {/* 左侧时间轴 */}
      <View style={styles.legRail}>
        <View style={[styles.legDot, { backgroundColor: iconInfo.color }]}>
          <Ionicons name={iconInfo.name as any} size={14} color={Colors.accent} />
        </View>
        {!isLast && <View style={styles.legLine} />}
      </View>

      {/* 右侧内容卡 */}
      <View style={[styles.legCard, isLast && { marginBottom: 0 }]}>
        <View style={styles.legCardHeader}>
          <Text style={styles.legTime}>
            {startTime} – {endTime}
          </Text>
          <View style={styles.legCardRight}>
            <Text style={styles.legCost}>{formatMoney(leg.estimated_cost, true)}</Text>
            {isEditing && (
              <View style={styles.legEditBtns}>
                <TouchableOpacity
                  style={[styles.legEditBtn, !canMoveUp && styles.legEditBtnDisabled]}
                  onPress={canMoveUp ? onMoveUp : undefined}>
                  <Ionicons name="chevron-up" size={14} color={canMoveUp ? Colors.primary : Colors.textLight} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.legEditBtn, !canMoveDown && styles.legEditBtnDisabled]}
                  onPress={canMoveDown ? onMoveDown : undefined}>
                  <Ionicons name="chevron-down" size={14} color={canMoveDown ? Colors.primary : Colors.textLight} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.legEditBtn, styles.legDeleteBtn]} onPress={onDelete}>
                  <Ionicons name="trash-outline" size={14} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={onPressPlace ? 0.6 : 1}
          onPress={onPressPlace}
          disabled={!onPressPlace}>
          <View style={styles.legPlaceRow}>
            <Text style={styles.legPlace}>{leg.place.name}</Text>
            {onPressPlace && (
              <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
            )}
          </View>
        </TouchableOpacity>
        {leg.transport && (
          <Text style={styles.legTransport}>
            {leg.transport.mode}
            {leg.transport.reference ? ` · ${leg.transport.reference}` : ''}
          </Text>
        )}
        {leg.tips && leg.tips.length > 0 && (
          <View style={styles.legTips}>
            {leg.tips.map((tip, i) => (
              <Text key={i} style={styles.legTipText}>
                {tip}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/* ─── 样式 ─── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingBottom: 100,
  },

  // ── Hero
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heroBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 6,
    backgroundColor: '#FFFFFF20',
  },
  heroBrandText: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.2,
  },
  heroMenu: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: FontWeight.heavy,
    color: Colors.accent,
    lineHeight: 44,
    letterSpacing: -1.2,
  },
  heroSub: {
    fontSize: FontSize.md,
    color: Colors.textOnDark,
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  heroMetric: {
    flex: 1,
    backgroundColor: '#FFFFFF20',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  heroMetricLabel: {
    color: Colors.textOnDark,
    fontSize: FontSize.xs,
  },
  heroMetricValue: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // ── Form Card
  formCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    ...Shadow.md,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  routeInput: {
    flex: 1,
  },
  routeArrow: {
    width: 36,
    alignItems: 'center',
    paddingBottom: 10,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },
  inputHighlight: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },

  // ── Hot destinations
  hotScroll: {
    marginBottom: Spacing.lg,
  },
  hotContent: {
    paddingVertical: Spacing.xs,
  },
  hotChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tag.bg,
    borderWidth: 1,
    borderColor: Colors.tag.border,
    marginRight: Spacing.sm,
  },
  hotChipActive: {
    backgroundColor: Colors.tagActive.bg,
    borderColor: Colors.tagActive.border,
  },
  hotChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  hotChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // ── Params
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  paramItem: {
    flex: 1,
  },
  paramDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  paramInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paramPrefix: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginRight: 2,
  },
  paramInput: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    flex: 1,
    paddingVertical: 2,
  },
  paramUnit: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginLeft: 4,
  },

  // ── Tags
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.xl,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  tagChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tag.bg,
    borderWidth: 1,
    borderColor: Colors.tag.border,
  },
  tagChipActive: {
    backgroundColor: Colors.tagActive.bg,
    borderColor: Colors.tagActive.border,
  },
  tagText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  tagTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // ── CTA
  ctaBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.colored(Colors.primary),
  },
  ctaBtnLoading: {
    opacity: 0.8,
  },
  ctaBtnText: {
    color: Colors.accent,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  loadingQuip: {
    textAlign: 'center',
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
  },

  // ── Error
  errorCard: {
    margin: Spacing.lg,
    padding: Spacing.xl,
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  retryBtnText: {
    color: Colors.accent,
    fontWeight: FontWeight.bold,
  },

  // ── Result
  resultArea: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  summaryCard: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadow.lg,
  },
  summaryTitle: {
    color: Colors.accent,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
    letterSpacing: -0.3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryPill: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  summaryPillValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  summaryPillValue: {
    color: Colors.accent,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
  },
  summaryPillSub: {
    color: Colors.textOnDark,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginBottom: 3,
    opacity: 0.75,
  },
  summaryPillLabel: {
    color: Colors.textOnDark,
    fontSize: FontSize.xs,
    marginTop: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cacheBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.success}18`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  cacheBadgeText: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  presetBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}18`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  presetBadgeText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  aiBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}18`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  aiBadgeText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  // ── Timeline
  timeline: {
    marginBottom: Spacing.lg,
  },
  timezoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    gap: 6,
  },
  timezoneText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  legRow: {
    flexDirection: 'row',
  },
  legRail: {
    width: 32,
    alignItems: 'center',
  },
  legDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  legLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.divider,
    marginVertical: 2,
  },
  legCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    marginLeft: Spacing.sm,
    ...Shadow.sm,
  },
  legCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  legCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legEditBtns: {
    flexDirection: 'row',
    gap: 2,
    marginLeft: Spacing.xs,
  },
  legEditBtn: {
    width: 26,
    height: 26,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legEditBtnDisabled: {
    opacity: 0.35,
  },
  legDeleteBtn: {
    backgroundColor: '#FEF2F2',
  },
  legTime: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.sm,
    letterSpacing: 0.3,
  },
  legCost: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  legPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  legPlace: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    lineHeight: 24,
    flex: 1,
  },
  legTransport: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  legTips: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  legTipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── Maps
  mapsBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
    ...Shadow.colored(Colors.primaryDark),
  },
  mapsBtnText: {
    color: Colors.accent,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },

  // ── Budget warning
  budgetWarnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  budgetWarnText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#92400E',
    lineHeight: 20,
  },

  // ── Result action bar
  resultActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  actionBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  actionBtnTextActive: {
    color: Colors.accent,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    ...Shadow.sm,
  },
  actionBtnSecondaryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
  },

  // ── Add Leg
  addLegSection: {
    marginBottom: Spacing.lg,
  },
  addLegBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  addLegBtnText: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.md,
  },
  addLegForm: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadow.md,
  },
  addLegFormTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  addLegInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  addLegRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  addLegCostWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  addLegLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  addLegCostInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    width: 80,
  },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    marginRight: Spacing.sm,
  },
  typeChipActive: {
    backgroundColor: Colors.primaryLight,
  },
  typeChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  typeChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  addLegFormBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addLegConfirm: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  addLegConfirmText: {
    color: Colors.accent,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  addLegCancel: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  addLegCancelText: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.md,
  },

  // ── Presets
  presetArea: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: Spacing.xs,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  presetCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  presetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  presetTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    flex: 1,
  },
  presetMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  presetChip: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
    fontWeight: FontWeight.medium,
    overflow: 'hidden',
  },

  // ── Place Detail Modal ──
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
