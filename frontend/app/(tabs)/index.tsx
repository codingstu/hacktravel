/**
 * Tab1 Plan — 行程生成主界面（v8 Stitch 统一风格）
 *
 * 设计语言（对齐 Stitch _1 / _4）：
 * - 顶部 Budget & Duration 指标栏（sticky 毛玻璃）
 * - Hero 图片卡 + 渐变遮罩 + 标题
 * - From ↔ To 输入行 + swap 按钮
 * - Continent pill 芯片 + Focus Region 标签
 * - 全底宽 "Plan My Trip" CTA
 * - 时间轴用色块圆点 + 竖线
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  saveItinerary,
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
import { HERO_IMAGE, RESULT_CARD_BG, getDestinationImage } from '@/services/images';
import { t } from '@/services/i18n';
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

/** 将 ApiError 转换为用户友好提示（自动多语言） */
function friendlyApiError(err: ApiError): string {
  switch (err.code) {
    case 'HKT_429_RATE_LIMITED':
      return err.retryAfter
        ? t('plan.rateLimited', { seconds: err.retryAfter })
        : t('plan.rateLimitedGeneric');
    case 'HKT_503_MODEL_UNAVAILABLE':
      return t('plan.modelUnavailable');
    case 'HKT_504_MODEL_TIMEOUT':
      return t('plan.modelTimeout');
    case 'HKT_599_FALLBACK_CACHE_MISS':
      return t('plan.allModelsFailed');
    case 'HKT_400_INVALID_INPUT':
      return t('plan.invalidInput', { msg: err.message });
    case 'HKT_422_SCHEMA_VALIDATION_FAILED':
      return t('plan.schemaError');
    default:
      return err.message || t('plan.unknownError');
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

/** 随机加载文案 key — 仅在 AI 生成时展示 */
const LOADING_QUIP_KEYS = [
  'plan.noPresetAI',
  'plan.searchBest',
  'plan.smartBudget',
  'plan.comfortPlan',
  'plan.everyMinute',
  'plan.perfectRoute',
];

/** 全局城市库用于自动补全 — 涵盖所有预置目的地 + 常见出发城市 */
const ALL_CITIES: string[] = [
  // 中国出发城市
  '上海', '北京', '广州', '深圳', '成都', '杭州', '南京', '武汉', '重庆', '西安',
  '长沙', '天津', '青岛', '大连', '厦门', '昆明', '郑州', '沈阳', '哈尔滨', '珠海',
  '三亚', '海口', '合肥', '福州', '济南', '宁波', '苏州', '无锡', '贵阳', '南宁',
  // 东亚
  '冲绳', '东京', '大阪', '首尔', '台北', '福冈', '京都', '北海道', '札幌', '香港',
  '澳门', '釜山',
  // 东南亚
  '曼谷', '清迈', '新加坡', '普吉岛', '巴厘岛', '槟城', '胡志明市', '河内', '岘港',
  '吉隆坡', '马尼拉', '宿务', '雅加达',
  // 欧洲
  '巴黎', '伦敦', '罗马', '巴塞罗那', '阿姆斯特丹', '爱丁堡', '曼彻斯特', '利物浦',
  '柏林', '里斯本', '布拉格', '维也纳',
  // 美洲
  '纽约', '洛杉矶', '里约热内卢', '圣保罗', '布宜诺斯艾利斯', '利马', '圣地亚哥',
  '温哥华', '墨西哥城', '波哥大', '卡塔赫纳',
  // 非洲 & 中东
  '开罗', '马拉喀什', '开普敦', '内罗毕', '桑给巴尔', '迪拜', '伊斯坦布尔',
  // 大洋洲
  '悉尼', '墨尔本', '奥克兰', '皇后镇',
];

/** 根据输入文字过滤城市建议 */
function filterCities(text: string, limit = 6): string[] {
  if (!text.trim()) return [];
  const q = text.trim().toLowerCase();
  return ALL_CITIES.filter(c => c.toLowerCase().includes(q) || c.startsWith(text)).slice(0, limit);
}

export default function GenerateScreen() {
  // ── Form ──
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [hours, setHours] = useState('48');
  const [budget, setBudget] = useState('3000');
  const [selectedTags, setSelectedTags] = useState<string[]>(['疯狂暴走']);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedContinent, setSelectedContinent] = useState<Continent>(DEFAULT_CONTINENT);
  const [selectedSubRegion, setSelectedSubRegion] = useState<string>('');
  const [regionMeta, setRegionMeta] = useState<RegionMeta[]>(REGION_METADATA_FALLBACK);
  const [featuredSubRegions, setFeaturedSubRegions] = useState<FeaturedSubRegion[]>(FEATURED_SUB_REGIONS_FALLBACK);
  const [regionLoading, setRegionLoading] = useState(true);

  // ── Autocomplete ──
  const [originFocused, setOriginFocused] = useState(false);
  const [destFocused, setDestFocused] = useState(false);
  const originSuggestions = useMemo(() => (originFocused ? filterCities(origin) : []), [origin, originFocused]);
  const destSuggestions = useMemo(() => (destFocused ? filterCities(destination) : []), [destination, destFocused]);

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
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 1500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    setSelectedSubRegion('');
  }, [selectedContinent]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(item => item !== tag) : [...prev, tag],
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!destination.trim()) {
      setErrorMsg(t('plan.invalidInput', { msg: t('plan.toPlaceholder') }));
      setViewState('error');
      return;
    }
    setViewState('loading');
    setErrorMsg('');
    setLoadingQuip(
      t(LOADING_QUIP_KEYS[Math.floor(Math.random() * LOADING_QUIP_KEYS.length)]),
    );

    try {
      const resp = await generateItinerary({
        origin: origin.trim() || t('plan.fromPlaceholder'),
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
        setErrorMsg(err.name === 'AbortError' ? t('plan.modelTimeout') : err.message);
      } else {
        setErrorMsg(t('plan.unknownError'));
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
    Alert.alert(t('common.delete'), `${editableLegs[i]?.place.name}?`, [
      { text: t('plan.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
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
    setLoadingQuip(t('plan.noPresetAI'));
    try {
      const resp = await generateItinerary({
        origin: origin.trim() || t('plan.fromPlaceholder'),
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
        setErrorMsg(err.name === 'AbortError' ? t('plan.modelTimeout') : err.message);
      else setErrorMsg(t('plan.unknownError'));
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

  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ── 顶部指标栏 — Stitch Budget & Duration bar ── */}
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
          <View style={styles.topBarItem}>
            <View style={styles.topBarIcon}>
              <Ionicons name="wallet-outline" size={18} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.topBarLabel}>{t('plan.budget')}</Text>
              <Text style={styles.topBarValue}>
                ¥{(parseInt(budget, 10) || 3000).toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={styles.topBarItem}>
            <View style={styles.topBarIcon}>
              <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.topBarLabel}>{t('plan.duration')}</Text>
              <Text style={styles.topBarValue}>{hours || '48'} {t('plan.hours')}</Text>
            </View>
          </View>
        </View>

        {/* ── Hero — Stitch 紧凑品牌条 ── */}
        <View style={styles.heroImageWrap}>
          <View style={styles.heroImage}>
            <Image
              source={{ uri: HERO_IMAGE }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.55)']}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>{t('plan.heroTitle')}</Text>
              <Text style={styles.heroSub}>{t('plan.heroSub')}</Text>
            </View>
          </View>
        </View>

        {/* ── 输入区 — Stitch From ↔ To ── */}
        <View style={styles.formCard}>
          {/* From ↔ To 行 */}
          <View style={styles.routeRow}>
            <View style={styles.routeInput}>
              <Text style={styles.fieldLabel}>{t('plan.from')}</Text>
              <TextInput
                style={styles.input}
                value={origin}
                onChangeText={setOrigin}
                onFocus={() => setOriginFocused(true)}
                onBlur={() => setTimeout(() => setOriginFocused(false), 200)}
                placeholder={t('plan.fromPlaceholder')}
                placeholderTextColor={Colors.textLight}
              />
              {originSuggestions.length > 0 && (
                <View style={styles.suggestBox}>
                  {originSuggestions.map(city => (
                    <TouchableOpacity
                      key={city}
                      style={styles.suggestItem}
                      onPress={() => { setOrigin(city); setOriginFocused(false); }}>
                      <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.suggestText}>{city}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.swapBtn}
              onPress={() => {
                const tmp = origin;
                setOrigin(destination);
                setDestination(tmp);
              }}
              activeOpacity={0.7}>
              <Ionicons name="swap-horizontal" size={16} color="#fff" />
            </TouchableOpacity>
            <View style={styles.routeInput}>
              <Text style={[styles.fieldLabel, { textAlign: 'right' }]}>{t('plan.to')}</Text>
              <TextInput
                style={[styles.input, { textAlign: 'right' }]}
                value={destination}
                onChangeText={setDestination}
                onFocus={() => setDestFocused(true)}
                onBlur={() => setTimeout(() => setDestFocused(false), 200)}
                placeholder={t('plan.toPlaceholder')}
                placeholderTextColor={Colors.textLight}
              />
              {destSuggestions.length > 0 && (
                <View style={[styles.suggestBox, { right: 0 }]}>
                  {destSuggestions.map(city => (
                    <TouchableOpacity
                      key={city}
                      style={styles.suggestItem}
                      onPress={() => { setDestination(city); setDestFocused(false); }}>
                      <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                      <Text style={styles.suggestText}>{city}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* 大洲开关 */}
          <Text style={styles.fieldLabel}>{t('plan.continent')}</Text>
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
              <Text style={styles.fieldLabel}>{t('plan.focusRegion')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.hotScroll}
                contentContainerStyle={styles.hotContent}>
                <TouchableOpacity
                  style={[styles.hotChip, !selectedSubRegion && styles.hotChipActive]}
                  onPress={() => setSelectedSubRegion('')}>
                  <Text style={[styles.hotChipText, !selectedSubRegion && styles.hotChipTextActive]}>
                    All
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
            <Text style={styles.loadingQuip}>{t('common.loading')}</Text>
          )}

          {/* DURATION & BUDGET */}
          <View style={styles.paramRow}>
            <View style={styles.paramItem}>
              <Text style={styles.fieldLabel}>{t('plan.durationLabel')}</Text>
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
              <Text style={styles.fieldLabel}>{t('plan.budgetLabel')}</Text>
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
          <Text style={styles.fieldLabel}>{t('plan.preferences')}</Text>
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

          {/* CTA — Stitch "Plan My Trip" 全宽按钮 */}
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
                <Text style={styles.ctaBtnText}>{t('plan.planMyTrip')}</Text>
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
              <Text style={styles.retryBtnText}>{t('plan.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 结果区 ── */}
        {viewState === 'success' && result && (
          <View style={styles.resultArea}>
            {/* 汇总卡 — 图片背景 */}
            <View style={styles.summaryCard}>
              <Image
                source={{ uri: destination ? getDestinationImage(destination, 800, 300) : RESULT_CARD_BG }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.6)']}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={styles.summaryTitle}>{result.title}</Text>
              <View style={styles.summaryRow}>
                <SummaryPill
                  label={t('plan.totalDuration')}
                  value={`${result.summary.total_hours}h`}
                />
                <SummaryPill
                  label={t('plan.estimatedCost')}
                  value={formatMoney(result.summary.estimated_total_cost)}
                  sub={result.summary.estimated_total_cost.currency}
                />
                <SummaryPill
                  label={t('plan.stops')}
                  value={`${editableLegs.length}`}
                />
              </View>
              {result.source.is_preset && (
                <View style={styles.presetBadge}>
                  <Ionicons name="flash" size={12} color={Colors.primary} />
                  <Text style={styles.presetBadgeText}>{t('plan.flashRecommend')}</Text>
                </View>
              )}
              {result.source.cache_hit && !result.source.is_preset && (
                <View style={styles.cacheBadge}>
                  <Ionicons name="flash" size={12} color={Colors.success} />
                  <Text style={styles.cacheBadgeText}>{t('plan.cacheHit')}</Text>
                </View>
              )}
              {!result.source.cache_hit && !result.source.is_preset && (
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={12} color={Colors.primary} />
                  <Text style={styles.aiBadgeText}>AI {t('plan.aiCustom')}</Text>
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
                      {t('plan.budgetWarn', { estimated: String(estimated), budget: String(userBudget) })}
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
                  {isEditing ? t('common.save') : t('plan.editRoute')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={handleForceAI}>
                <Ionicons name="sparkles" size={16} color={Colors.accent} />
                <Text style={styles.actionBtnSecondaryText}>{t('plan.aiReplan')}</Text>
              </TouchableOpacity>
            </View>

            {/* 保存行程 */}
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={async () => {
                if (!result) return;
                try {
                  // 确保 device_id 存在（若用户未打开过 Profile 页面则自动生成）
                  let deviceId = await AsyncStorage.getItem('device_id');
                  if (!deviceId) {
                    deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                    await AsyncStorage.setItem('device_id', deviceId);
                  }
                  const resp = await saveItinerary({
                    device_id: deviceId,
                    itinerary_id: result.itinerary_id,
                    title: result.title || `${origin.trim()} → ${destination.trim()}`,
                    destination: destination.trim() || 'Trip',
                    stops: result.legs.length,
                    days: Math.max(1, Math.round((parseInt(hours, 10) || 48) / 24)),
                    cover_image: getDestinationImage(destination.trim(), 800, 400),
                  });
                  if (resp.success) {
                    setToastMessage(t('profile.savedToast'));
                  } else {
                    setToastMessage(resp.message || t('profile.saveFail'));
                  }
                } catch (err: any) {
                  if (__DEV__) console.error('[Save]', err?.message);
                  setToastMessage(t('profile.saveFail'));
                }
              }}>
              <Ionicons name="bookmark-outline" size={16} color={Colors.primary} />
              <Text style={styles.saveBtnText}>{t('profile.saveItinerary')}</Text>
            </TouchableOpacity>

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
                        {t('plan.localTimeNote', { tz: tzLabel })}
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
                    <Text style={styles.addLegBtnText}>{t('plan.addStop')}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.addLegForm}>
                    <Text style={styles.addLegFormTitle}>{t('plan.addStopTitle')}</Text>
                    <TextInput
                      style={styles.addLegInput}
                      value={newLegName}
                      onChangeText={setNewLegName}
                      placeholder={t('plan.placeNamePlaceholder')}
                      placeholderTextColor={Colors.textLight}
                    />
                    <View style={styles.addLegRow}>
                      <View style={styles.addLegCostWrap}>
                        <Text style={styles.addLegLabel}>{t('plan.estimatedCostLabel')}</Text>
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
                        { key: 'attraction', label: t('plan.attraction') },
                        { key: 'food', label: t('plan.food') },
                        { key: 'transit', label: t('plan.transit') },
                        { key: 'shopping', label: t('plan.shopping') },
                        { key: 'rest', label: t('plan.rest') },
                        { key: 'flight', label: t('plan.flight') },
                      ].map(t_item => (
                        <TouchableOpacity
                          key={t_item.key}
                          style={[
                            styles.typeChip,
                            newLegType === t_item.key && styles.typeChipActive,
                          ]}
                          onPress={() => setNewLegType(t_item.key)}>
                          <Text
                            style={[
                              styles.typeChipText,
                              newLegType === t_item.key && styles.typeChipTextActive,
                            ]}>
                            {t_item.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={styles.addLegFormBtns}>
                      <TouchableOpacity
                        style={styles.addLegConfirm}
                        onPress={addLeg}>
                        <Text style={styles.addLegConfirmText}>{t('plan.confirm')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.addLegCancel}
                        onPress={() => setShowAddLeg(false)}>
                        <Text style={styles.addLegCancelText}>{t('plan.cancel')}</Text>
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
                {t('plan.openMaps', { count: String(result.map.waypoints_count) })}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 空态：推荐路线 ── */}
        {viewState === 'idle' && (
          <View style={styles.presetArea}>
            <Text style={styles.sectionLabel}>{t('plan.hotRoutes')}</Text>
            <Text style={styles.sectionDesc}>
              {activeRegion ? t('plan.hotRoutesRegion', { region: activeRegion.label }) : t('plan.hotRoutesDesc')}
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
                    {t('plan.presetUsers', { count: route.copy_count })}
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
                <Text style={styles.modalLoadingText}>{t('plan.placeDetailLoading')}</Text>
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
                    <Text style={styles.modalSectionTitle}>Description</Text>
                    <Text style={styles.modalDesc}>{placeDetail.description}</Text>
                  </View>
                ) : null}

                {/* Insider Tips / 热门评价 */}
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
                      <Text style={styles.modalActionText}>Google Maps</Text>
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

    {!!toastMessage && (
      <View pointerEvents="none" style={styles.toastWrap}>
        <View style={styles.toastCard}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      </View>
    )}
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
    paddingBottom: 120,
  },

  // ── Top Bar (Budget & Duration) — Stitch _1
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.background,
  },
  topBarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  topBarIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.tagActive.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  topBarValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },

  // ── Hero Image — Stitch compact brand bar
  heroImageWrap: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  heroImage: {
    height: 100,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroOverlay: {
    padding: Spacing.md,
  },
  heroTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  heroSub: {
    fontSize: FontSize.xs,
    color: '#ffffffCC',
    marginTop: 2,
  },

  // ── Form Card — Stitch _1 / _4
  formCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    ...Shadow.sm,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.lg,
    zIndex: 10,
  },
  routeInput: {
    flex: 1,
    position: 'relative',
    zIndex: 10,
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.sm,
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.textLight,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },

  // ── Autocomplete suggestions
  suggestBox: {
    position: 'absolute',
    top: '100%',
    left: 0,
    minWidth: 160,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    ...Shadow.md,
    zIndex: 999,
    paddingVertical: 4,
  },
  suggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  suggestText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },

  // ── Hot destinations / Continent chips — Stitch pill style
  hotScroll: {
    marginBottom: Spacing.md,
  },
  hotContent: {
    paddingVertical: Spacing.xs,
  },
  hotChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tagActive.bg,
    marginRight: Spacing.sm,
  },
  hotChipActive: {
    backgroundColor: Colors.primary,
  },
  hotChipText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  hotChipTextActive: {
    color: '#fff',
    fontWeight: FontWeight.bold,
  },

  // ── Params — Duration & Budget
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
  },
  paramItem: {
    flex: 1,
  },
  paramDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.tagActive.border,
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

  // ── Tags — Stitch rounded-xl chips
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.xl,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  tagChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.tagActive.bg,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
  },
  tagChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tagText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  tagTextActive: {
    color: '#fff',
    fontWeight: FontWeight.bold,
  },

  // ── CTA — Stitch full-width xl button
  ctaBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    height: 56,
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
    letterSpacing: 0.3,
  },
  loadingQuip: {
    textAlign: 'center',
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
  },

  // ── Error — Stitch error banner
  errorCard: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: '#fef2f2',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  errorText: {
    flex: 1,
    color: '#dc2626',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  retryBtnText: {
    color: Colors.accent,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },

  // ── Result
  resultArea: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  summaryCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
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
    color: '#ffffffAA',
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: FontWeight.bold,
  },
  cacheBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  cacheBadgeText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  presetBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  presetBadgeText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  aiBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  aiBadgeText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  // ── Timeline — Stitch _2 dot + line
  timeline: {
    marginBottom: Spacing.lg,
  },
  timezoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tagActive.bg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
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
    backgroundColor: Colors.tagActive.border,
    marginVertical: 2,
  },
  legCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
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
    color: Colors.textLight,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.xs,
    letterSpacing: 0.3,
  },
  legCost: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.sm,
  },
  legPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  legPlace: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    lineHeight: 22,
    flex: 1,
  },
  legTransport: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 2,
  },
  legTips: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  legTipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // ── Maps CTA
  mapsBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
    ...Shadow.colored(Colors.primary),
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
    borderRadius: BorderRadius.xl,
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
  saveBtn: {
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    backgroundColor: Colors.surface,
  },
  saveBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
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
    backgroundColor: 'rgba(17,24,39,0.95)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  toastText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 48,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    backgroundColor: Colors.surface,
  },
  actionBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
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
    height: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    ...Shadow.sm,
  },
  actionBtnSecondaryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
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
    height: 48,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.tagActive.border,
    borderStyle: 'dashed',
  },
  addLegBtnText: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.md,
  },
  addLegForm: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
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
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
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
    borderRadius: BorderRadius.md,
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
    backgroundColor: Colors.tagActive.bg,
    marginRight: Spacing.sm,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
  },
  typeChipText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  typeChipTextActive: {
    color: '#fff',
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
    borderRadius: BorderRadius.xl,
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
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  addLegCancelText: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.md,
  },

  // ── Presets — Stitch card style
  presetArea: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  presetCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    ...Shadow.sm,
  },
  presetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  presetTitle: {
    fontSize: FontSize.md,
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
    borderRadius: BorderRadius.full,
    fontWeight: FontWeight.medium,
    overflow: 'hidden',
  },

  // ── Place Detail Modal — Stitch card style
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
});
