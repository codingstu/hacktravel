/**
 * Tab4 Profile — 用户中心（v8 Stitch 统一风格）
 *
 * 设计语言（对齐 Stitch 设计稿）：
 * - 顶部 My Profile 标题 + 设置/退出图标
 * - 用户头像卡片 + Edit Profile + 分享按钮
 * - 统计数据栏（TRIPS / SAVED / REVIEWS）
 * - Active Price Alerts 区块
 * - Saved Itineraries 卡片列表
 * - Personal Preferences 设置项
 *
 * 对接真实后端 API，使用 device_id 作为匿名用户标识。
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Switch,
  Alert,
  Platform,
  RefreshControl,
  TextInput,
  Modal,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import {
  Colors,
  Spacing,
  FontSize,
  FontWeight,
  BorderRadius,
  Shadow,
  ThemeColors,
} from '@/constants/Theme';
import { t, setLocale } from '@/services/i18n';
import { getDestinationImage } from '@/services/images';
import { useThemeMode } from '@/services/theme';
import { Toast } from '@/components/Toast';
import {
  fetchProfile,
  fetchProfileStats,
  fetchPreferences,
  updatePreferences,
  fetchSavedItineraries,
  deleteSavedItinerary,
  updateProfile,
  fetchPriceAlerts,
} from '@/services/api';
import type {
  UserProfile,
  UserStats,
  UserPreferences,
  SavedItinerary,
  PriceAlertItem,
} from '@/services/types';

/* ── 偏好设置选项 ── */
const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
];
const CURRENCY_OPTIONS = ['USD', 'CNY', 'JPY', 'EUR', 'GBP'];

type ViewState = 'idle' | 'loading' | 'error';

// 简单的设备 ID 生成器
const getDeviceId = async () => {
  let deviceId = await AsyncStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await AsyncStorage.setItem('device_id', deviceId);
  }
  return deviceId;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { colors, setMode } = useThemeMode();
  const router = useRouter();

  const [viewState, setViewState] = useState<ViewState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');

  // ── 数据状态 ──
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [itineraries, setItineraries] = useState<SavedItinerary[]>([]);
  const [alerts, setAlerts] = useState<PriceAlertItem[]>([]);
  const [alertsVisible, setAlertsVisible] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const [currencyVisible, setCurrencyVisible] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // ── 行程详情 Modal ──
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailItinerary, setDetailItinerary] = useState<SavedItinerary | null>(null);

  // ── 统计Tab ──
  const [activeStatTab, setActiveStatTab] = useState<'trips' | 'saved' | 'reviews'>('saved');

  // section refs 用于滚动定位
  const savedSectionRef = useRef<View>(null);
  const savedSectionY = useRef(0);

  // ── 编辑资料状态 ──
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCountries, setEditCountries] = useState('0');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setViewState('loading');

    try {
      const id = await getDeviceId();
      setDeviceId(id);

      // 使用 allSettled 代替 all，避免单个 API 失败导致整页崩溃
      const [profileResult, statsResult, prefsResult, itinsResult] = await Promise.allSettled([
        fetchProfile(id),
        fetchProfileStats(id),
        fetchPreferences(id),
        fetchSavedItineraries(id),
      ]);

      // 至少需要 profile 接口成功，其余可降级
      if (profileResult.status === 'fulfilled') {
        const profileRes = profileResult.value;
        setProfile(profileRes.profile);
        setEditName(profileRes.profile.name || '');
        setEditTagline(profileRes.profile.tagline || '');
        setEditEmail(profileRes.profile.email || '');
        setEditCountries(String(profileRes.profile.countries_visited || 0));

        // 加载价格提醒（非关键路径）
        if (profileRes.profile.email) {
          try {
            const alertsRes = await fetchPriceAlerts(profileRes.profile.email);
            setAlerts(alertsRes.alerts);
          } catch {
            setAlerts([]);
          }
        } else {
          setAlerts([]);
        }
      } else {
        // profile 也失败了，设置默认值让页面仍可展示
        console.warn('Profile API failed, using defaults:', profileResult.reason);
        setProfile({
          device_id: id,
          name: 'Traveler',
          tagline: 'Travel Enthusiast',
          avatar_url: '',
          email: '',
          countries_visited: 0,
          created_at: new Date().toISOString(),
        } as any);
        setAlerts([]);
      }

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value.stats);
      } else {
        console.warn('Stats API failed, using defaults');
        setStats({ trips: 0, saved: 0, reviews: 0 } as any);
      }

      if (prefsResult.status === 'fulfilled') {
        const prefsRes = prefsResult.value;
        setPreferences(prefsRes.preferences);
        if (prefsRes.preferences.language === 'zh' || prefsRes.preferences.language === 'en') {
          setLocale(prefsRes.preferences.language as 'zh' | 'en');
        }
        setMode(prefsRes.preferences.dark_mode ? 'dark' : 'light');
      } else {
        console.warn('Preferences API failed, using defaults');
        setPreferences({ dark_mode: false, language: 'en', currency: 'USD' } as any);
      }

      if (itinsResult.status === 'fulfilled') {
        setItineraries(itinsResult.value.itineraries);
      } else {
        console.warn('Itineraries API failed, using defaults');
        setItineraries([]);
      }

      setViewState('idle');
    } catch (error) {
      console.error('Failed to load profile data:', error);
      setViewState('error');
    } finally {
      setRefreshing(false);
    }
  }, [setMode]);

  // ── 每次 Tab 获得焦点时刷新数据（修复从 Plan 页保存行程后切到 Profile 不刷新的问题）──
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const themedStyles = useMemo(() => createStyles(colors), [colors]);

  // ── 事件处理 ──
  const handleEditProfile = useCallback(() => {
    setEditVisible(true);
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (!deviceId) return;
    try {
      const res = await updateProfile({
        device_id: deviceId,
        name: editName.trim(),
        tagline: editTagline.trim(),
        email: editEmail.trim(),
        countries_visited: Math.max(0, Number(editCountries) || 0),
      });
      setProfile(res.profile);
      setEditVisible(false);
    } catch (e) {
      Alert.alert(t('common.error'));
    }
  }, [deviceId, editName, editTagline, editEmail, editCountries]);

  const handleShare = useCallback(async () => {
    const shareText = `${profile?.name || 'Traveler'} · HackTravel Profile`;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : undefined;
    const fallbackText = shareUrl ? `${shareText} ${shareUrl}` : shareText;
    if (Platform.OS === 'web') {
      try {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: 'HackTravel', text: shareText, url: shareUrl });
          return;
        }
      } catch {
        // fall back to clipboard
      }
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl || shareText);
          setToastMessage(t('profile.shareCopied'));
          return;
        }
      } catch {
        // ignore
      }
    }
    try {
      await Share.share({ message: fallbackText });
    } catch {
      setToastMessage(t('common.error'));
    }
  }, [profile]);

  const handlePickAvatar = useCallback(async () => {
    if (!deviceId) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setToastMessage(t('common.error'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const res = await updateProfile({
        device_id: deviceId,
        avatar_url: asset.uri,
      });
      setProfile(res.profile);
    } catch {
      setToastMessage(t('common.error'));
    }
  }, [deviceId]);

  const handleSettings = useCallback(() => {
    // 滚动到偏好区块
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 900, animated: true });
    }
  }, []);

  const handleLogout = useCallback(() => {
    setLogoutVisible(true);
  }, []);

  const confirmLogout = useCallback(async () => {
    await AsyncStorage.removeItem('device_id');
    setDeviceId('');
    setProfile(null);
    setStats(null);
    setPreferences(null);
    setItineraries([]);
    setAlerts([]);
    setLogoutVisible(false);
    await loadData();
  }, [loadData]);

  const handleViewAllAlerts = useCallback(async () => {
    if (!deviceId) return;
    if (!profile?.email) {
      Alert.alert(t('common.error'), t('profile.setEmailHint'));
      return;
    }
    try {
      const res = await fetchPriceAlerts(profile.email);
      setAlerts(res.alerts);
      setAlertsVisible(true);
    } catch {
      Alert.alert(t('common.error'));
    }
  }, [deviceId, profile]);

  const handleManageItineraries = useCallback(() => {
    setManageVisible(true);
  }, []);

  // ── 点击行程卡片展示详情 ──
  const handlePressItinerary = useCallback((itinerary: SavedItinerary) => {
    setDetailItinerary(itinerary);
    setDetailVisible(true);
  }, []);

  // ── 从详情跳回 Plan 页重新规划 ──
  const handlePlanAgain = useCallback((destination: string) => {
    setDetailVisible(false);
    // 使用 router 跳转到 Plan 页并传参
    router.push({ pathname: '/(tabs)', params: { destination } });
  }, [router]);

  // ── 统计 Tab 点击 ──
  const handleStatTabPress = useCallback((tab: 'trips' | 'saved' | 'reviews') => {
    setActiveStatTab(tab);
    // 滚动到已保存行程区块（saved tab 最常用）
    if (tab === 'saved' && scrollRef.current) {
      scrollRef.current.scrollTo({ y: savedSectionY.current, animated: true });
    }
  }, []);

  const handleLanguageSelect = useCallback(() => {
    setLanguageVisible(true);
  }, []);

  const handleSelectLanguage = useCallback(async (value: 'zh' | 'en') => {
    if (!deviceId) return;
    const previous = preferences?.language || 'en';
    setPreferences(prev => prev ? { ...prev, language: value } : null);
    setLocale(value);
    setLanguageVisible(false);
    try {
      await updatePreferences({ device_id: deviceId, language: value });
    } catch (e) {
      setPreferences(prev => prev ? { ...prev, language: previous } : null);
      setLocale(previous as 'zh' | 'en');
      setToastMessage(t('common.error'));
    }
  }, [deviceId, preferences]);

  const handleCurrencySelect = useCallback(() => {
    setCurrencyVisible(true);
  }, []);

  const handleSelectCurrency = useCallback(async (value: string) => {
    if (!deviceId) return;
    const previous = preferences?.currency || 'USD';
    setPreferences(prev => prev ? { ...prev, currency: value } : null);
    setCurrencyVisible(false);
    try {
      await updatePreferences({ device_id: deviceId, currency: value });
    } catch (e) {
      setPreferences(prev => prev ? { ...prev, currency: previous } : null);
      setToastMessage(t('common.error'));
    }
  }, [deviceId, preferences]);

  const handleToggleDarkMode = useCallback(async (value: boolean) => {
    if (!deviceId) return;
    try {
      // 乐观更新
      setPreferences(prev => prev ? { ...prev, dark_mode: value } : null);
      setMode(value ? 'dark' : 'light');
      await updatePreferences({ device_id: deviceId, dark_mode: value });
    } catch (e) {
      // 恢复
      setPreferences(prev => prev ? { ...prev, dark_mode: !value } : null);
      setMode(!value ? 'dark' : 'light');
      setToastMessage(t('common.error'));
    }
  }, [deviceId, setMode]);

  const handleDeleteItinerary = useCallback(async (id: string) => {
    try {
      await deleteSavedItinerary(deviceId, id);
      setItineraries(prev => prev.filter(i => i.itinerary_id !== id));
      setStats(prev => prev ? { ...prev, saved: Math.max(0, prev.saved - 1) } : null);
      setToastMessage(t('profile.removedToast'));
    } catch (e) {
      setToastMessage(t('common.error'));
    }
  }, [deviceId]);

  // ── 空态 / 加载态 / 错误态 ──
  if (viewState === 'loading') {
    return (
      <View style={[themedStyles.container, { paddingTop: insets.top }]}>
        <View style={themedStyles.centerContent}>
          <Text style={themedStyles.loadingText}>{t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  if (viewState === 'error') {
    return (
      <View style={[themedStyles.container, { paddingTop: insets.top }]}>
        <View style={themedStyles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={themedStyles.errorText}>{t('common.error')}</Text>
          <TouchableOpacity
            style={{ marginTop: Spacing.md, backgroundColor: colors.primary, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md }}
            onPress={() => loadData()}>
            <Text style={{ color: colors.textOnPrimary, fontWeight: FontWeight.semibold, fontSize: FontSize.md }}>
              {t('common.retry') || 'Retry'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[themedStyles.container, { paddingTop: insets.top }]}>
      {/* ── 顶部标题栏 ── */}
      <View style={themedStyles.header}>
        <TouchableOpacity onPress={handleSettings} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="settings-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={themedStyles.headerTitle}>{t('profile.title')}</Text>
        <TouchableOpacity onPress={handleLogout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="log-out-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={themedStyles.scrollView}
        contentContainerStyle={[themedStyles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          Platform.OS === 'web'
            ? undefined
            : <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
        }
      >
        {/* ── 用户头像卡片 ── */}
        <View style={[themedStyles.profileCard, Shadow.md]}>
          <TouchableOpacity style={themedStyles.avatarContainer} onPress={handlePickAvatar}>
            <Image
              source={{ uri: profile?.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format&q=80' }}
              style={themedStyles.avatar}
            />
            <View style={themedStyles.cameraIconWrap}>
              <Ionicons name="camera" size={14} color={colors.textOnPrimary} />
            </View>
          </TouchableOpacity>
          <Text style={themedStyles.userName}>{profile?.name || 'Traveler'}</Text>
          <View style={themedStyles.taglineRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={themedStyles.taglineText}>
              {profile?.tagline || 'Travel Enthusiast'} • {profile?.countries_visited || 0} {t('profile.countries')}
            </Text>
          </View>
          <View style={themedStyles.actionRow}>
            <TouchableOpacity style={themedStyles.editProfileBtn} onPress={handleEditProfile}>
              <Text style={themedStyles.editProfileText}>{t('profile.editProfile')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={themedStyles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 统计数据栏（可点击） ── */}
        <View style={themedStyles.statsRow}>
          <TouchableOpacity
            style={[themedStyles.statItem, activeStatTab === 'trips' && themedStyles.statItemActive]}
            onPress={() => handleStatTabPress('trips')}
            activeOpacity={0.7}
          >
            <Text style={[themedStyles.statNumber, activeStatTab === 'trips' && themedStyles.statNumberActive]}>
              {stats?.trips || 0}
            </Text>
            <Text style={[themedStyles.statLabel, activeStatTab === 'trips' && themedStyles.statLabelActive]}>
              {t('profile.trips')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[themedStyles.statItem, activeStatTab === 'saved' && themedStyles.statItemActive]}
            onPress={() => handleStatTabPress('saved')}
            activeOpacity={0.7}
          >
            <Text style={[themedStyles.statNumber, activeStatTab === 'saved' && themedStyles.statNumberActive]}>
              {stats?.saved || 0}
            </Text>
            <Text style={[themedStyles.statLabel, activeStatTab === 'saved' && themedStyles.statLabelActive]}>
              {t('profile.saved')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[themedStyles.statItem, activeStatTab === 'reviews' && themedStyles.statItemActive]}
            onPress={() => handleStatTabPress('reviews')}
            activeOpacity={0.7}
          >
            <Text style={[themedStyles.statNumber, activeStatTab === 'reviews' && themedStyles.statNumberActive]}>
              {stats?.reviews || 0}
            </Text>
            <Text style={[themedStyles.statLabel, activeStatTab === 'reviews' && themedStyles.statLabelActive]}>
              {t('profile.reviews')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Active Price Alerts ── */}
        <View style={themedStyles.sectionHeader}>
          <Text style={themedStyles.sectionTitle}>{t('profile.activePriceAlerts')}</Text>
          <TouchableOpacity onPress={handleViewAllAlerts}>
            <Text style={themedStyles.sectionAction}>{t('profile.viewAll')}</Text>
          </TouchableOpacity>
        </View>
        {alerts.length === 0 ? (
          <View style={[themedStyles.alertCard, themedStyles.emptyAlertCard, Shadow.sm]}>
            <Ionicons name="notifications-off-outline" size={32} color={colors.textLight} />
            <Text style={themedStyles.emptyAlertTitle}>{t('profile.noAlerts')}</Text>
            <Text style={themedStyles.emptyAlertDesc}>{t('profile.setEmailHint')}</Text>
            <TouchableOpacity style={themedStyles.emptyAlertBtn} onPress={() => router.push('/(tabs)/watchlist')}>
              <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
              <Text style={themedStyles.emptyAlertBtnText}>{t('profile.goSetAlert')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          alerts.slice(0, 1).map(alert => (
            <View key={alert.alert_id} style={[themedStyles.alertCard, Shadow.sm]}>
              <View style={themedStyles.alertIconWrap}>
                <Ionicons name="notifications-outline" size={22} color={colors.primary} />
              </View>
              <View style={themedStyles.alertContent}>
                <Text style={themedStyles.alertRoute}>
                  {alert.origin} {t('profile.to')} {alert.destination}
                </Text>
                <Text style={themedStyles.alertTarget}>
                  {t('profile.targetPrice')}: {t('profile.under')} {alert.max_price}
                </Text>
              </View>
              <View style={themedStyles.alertDropWrap}>
                <Text style={themedStyles.alertDropText}>{alert.status}</Text>
              </View>
            </View>
          ))
        )}

        {/* ── Saved Itineraries ── */}
        <View
          style={themedStyles.sectionHeader}
          ref={savedSectionRef}
          onLayout={(e) => { savedSectionY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={themedStyles.sectionTitle}>{t('profile.savedItineraries')}</Text>
          <TouchableOpacity onPress={handleManageItineraries}>
            <Text style={themedStyles.sectionAction}>{t('profile.manage')}</Text>
          </TouchableOpacity>
        </View>
        {itineraries.length === 0 ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginVertical: Spacing.lg }}>
            {t('profile.noItineraries')}
          </Text>
        ) : (
          itineraries.map(itinerary => (
            <TouchableOpacity
              key={itinerary.itinerary_id}
              style={[themedStyles.itineraryCard, Shadow.sm]}
              activeOpacity={0.8}
              onPress={() => handlePressItinerary(itinerary)}
            >
              <Image
                source={{ uri: itinerary.cover_image || getDestinationImage(itinerary.destination, 800, 400) }}
                style={themedStyles.itineraryImage}
              />
              <TouchableOpacity
                style={themedStyles.itineraryBookmark}
                onPress={() => handleDeleteItinerary(itinerary.itinerary_id)}
              >
                <Ionicons name="bookmark" size={20} color={colors.primary} />
              </TouchableOpacity>
              <View style={themedStyles.itineraryInfo}>
                <Text style={themedStyles.itineraryTitle}>{itinerary.title}</Text>
                <Text style={themedStyles.itineraryMeta}>
                  {itinerary.stops} {t('profile.stops')} • {itinerary.days} {t('profile.days')}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* ── Personal Preferences ── */}
        <Text style={[themedStyles.sectionTitle, { marginTop: Spacing.xl, marginBottom: Spacing.md }]}>
          {t('profile.personalPreferences')}
        </Text>

        {/* Dark Mode */}
        <View style={[themedStyles.prefRow, Shadow.sm]}>
          <View style={themedStyles.prefLeft}>
            <View style={[themedStyles.prefIconWrap, { backgroundColor: colors.secondaryLight }]}>
              <Ionicons name="moon" size={18} color="#FFFFFF" />
            </View>
            <Text style={themedStyles.prefLabel}>{t('profile.darkMode')}</Text>
          </View>
          <Switch
            value={preferences?.dark_mode || false}
            onValueChange={handleToggleDarkMode}
            trackColor={{ false: colors.tag.bg, true: colors.primary }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.tag.bg}
          />
        </View>

        {/* Preferred Language */}
        <TouchableOpacity style={[themedStyles.prefRow, Shadow.sm]} onPress={handleLanguageSelect}>
          <View style={themedStyles.prefLeft}>
            <View style={[themedStyles.prefIconWrap, { backgroundColor: colors.primary }]}>
              <Ionicons name="globe-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={themedStyles.prefLabel}>{t('profile.preferredLanguage')}</Text>
          </View>
          <View style={themedStyles.prefRight}>
            <Text style={themedStyles.prefValue}>
              {LANGUAGE_OPTIONS.find(l => l.value === preferences?.language)?.label || 'English'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </View>
        </TouchableOpacity>

        {/* Default Currency */}
        <TouchableOpacity style={[themedStyles.prefRow, Shadow.sm]} onPress={handleCurrencySelect}>
          <View style={themedStyles.prefLeft}>
            <View style={[themedStyles.prefIconWrap, { backgroundColor: colors.primary }]}>
              <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={themedStyles.prefLabel}>{t('profile.defaultCurrency')}</Text>
          </View>
          <View style={themedStyles.prefRight}>
            <Text style={themedStyles.prefValue}>{preferences?.currency || 'USD'}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </View>
        </TouchableOpacity>

      </ScrollView>

      {editVisible && (
        <Modal transparent visible={editVisible} animationType="fade">
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalCard}>
              <Text style={themedStyles.modalTitle}>{t('profile.editProfile')}</Text>
              <TextInput
                style={themedStyles.modalInput}
                placeholder={t('profile.name')}
                value={editName}
                onChangeText={setEditName}
              />
              <TextInput
                style={themedStyles.modalInput}
                placeholder={t('profile.tagline')}
                value={editTagline}
                onChangeText={setEditTagline}
              />
              <TextInput
                style={themedStyles.modalInput}
                placeholder={t('profile.email')}
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={themedStyles.modalInput}
                placeholder={t('profile.countriesVisited')}
                value={editCountries}
                onChangeText={setEditCountries}
                keyboardType="numeric"
              />
              <View style={themedStyles.modalActions}>
                <TouchableOpacity style={themedStyles.modalCancel} onPress={() => setEditVisible(false)}>
                  <Text style={themedStyles.modalCancelText}>{t('plan.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={themedStyles.modalSave} onPress={handleSaveProfile}>
                  <Text style={themedStyles.modalSaveText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {alertsVisible && (
        <Modal transparent visible={alertsVisible} animationType="slide">
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalCardLarge}>
              <Text style={themedStyles.modalTitle}>{t('profile.activePriceAlerts')}</Text>
              <ScrollView style={{ maxHeight: 360 }}>
                {alerts.length === 0 ? (
                  <Text style={themedStyles.modalEmpty}>{t('profile.noAlerts')}</Text>
                ) : (
                  alerts.map(alert => (
                    <View key={alert.alert_id} style={themedStyles.alertListItem}>
                      <Text style={themedStyles.alertRoute}>{alert.origin} {t('profile.to')} {alert.destination}</Text>
                      <Text style={themedStyles.alertTarget}>{t('profile.targetPrice')}: {alert.max_price}</Text>
                      <Text style={themedStyles.alertTodayText}>{alert.status}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity style={themedStyles.modalCancel} onPress={() => setAlertsVisible(false)}>
                <Text style={themedStyles.modalCancelText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {manageVisible && (
        <Modal transparent visible={manageVisible} animationType="slide">
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalCardLarge}>
              <Text style={themedStyles.modalTitle}>{t('profile.savedItineraries')}</Text>
              <ScrollView style={{ maxHeight: 360 }}>
                {itineraries.length === 0 ? (
                  <Text style={themedStyles.modalEmpty}>{t('profile.noItineraries')}</Text>
                ) : (
                  itineraries.map(itinerary => (
                    <View key={itinerary.itinerary_id} style={themedStyles.alertListItem}>
                      <Text style={themedStyles.itineraryTitle}>{itinerary.title}</Text>
                      <Text style={themedStyles.itineraryMeta}>
                        {itinerary.stops} {t('profile.stops')} • {itinerary.days} {t('profile.days')}
                      </Text>
                      <TouchableOpacity
                        style={themedStyles.deleteInline}
                        onPress={() => handleDeleteItinerary(itinerary.itinerary_id)}
                      >
                        <Text style={themedStyles.deleteInlineText}>{t('common.delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity style={themedStyles.modalCancel} onPress={() => setManageVisible(false)}>
                <Text style={themedStyles.modalCancelText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {languageVisible && (
        <Modal transparent visible={languageVisible} animationType="fade">
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalCard}>
              <Text style={themedStyles.modalTitle}>{t('profile.preferredLanguage')}</Text>
              {LANGUAGE_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={themedStyles.optionRow}
                  onPress={() => handleSelectLanguage(option.value as 'zh' | 'en')}
                >
                  <Text style={themedStyles.optionText}>{option.label}</Text>
                  {preferences?.language === option.value && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={themedStyles.modalCancel} onPress={() => setLanguageVisible(false)}>
                <Text style={themedStyles.modalCancelText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {currencyVisible && (
        <Modal transparent visible={currencyVisible} animationType="fade">
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalCard}>
              <Text style={themedStyles.modalTitle}>{t('profile.defaultCurrency')}</Text>
              {CURRENCY_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option}
                  style={themedStyles.optionRow}
                  onPress={() => handleSelectCurrency(option)}
                >
                  <Text style={themedStyles.optionText}>{option}</Text>
                  {preferences?.currency === option && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={themedStyles.modalCancel} onPress={() => setCurrencyVisible(false)}>
                <Text style={themedStyles.modalCancelText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {logoutVisible && (
        <Modal transparent visible={logoutVisible} animationType="fade">
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalCard}>
              <Text style={themedStyles.modalTitle}>{t('profile.logout')}</Text>
              <Text style={themedStyles.modalEmpty}>{t('profile.logoutConfirm')}</Text>
              <View style={themedStyles.modalActions}>
                <TouchableOpacity style={themedStyles.modalCancel} onPress={() => setLogoutVisible(false)}>
                  <Text style={themedStyles.modalCancelText}>{t('plan.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={themedStyles.modalSave} onPress={confirmLogout}>
                  <Text style={themedStyles.modalSaveText}>{t('profile.logout')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <Toast message={toastMessage} onDismiss={() => setToastMessage('')} />

      {/* ── 行程详情 Modal ── */}
      {detailVisible && detailItinerary && (
        <Modal transparent visible={detailVisible} animationType="slide">
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalCardLarge}>
              {/* X 关闭按钮 */}
              <TouchableOpacity
                style={themedStyles.modalCloseX}
                onPress={() => setDetailVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              {/* 封面图 */}
              <Image
                source={{ uri: detailItinerary.cover_image || getDestinationImage(detailItinerary.destination, 800, 400) }}
                style={themedStyles.detailCoverImage}
              />
              <Text style={themedStyles.modalTitle}>{detailItinerary.title}</Text>
              <View style={themedStyles.detailMetaRow}>
                <View style={themedStyles.detailMetaItem}>
                  <Ionicons name="location-outline" size={16} color={colors.primary} />
                  <Text style={themedStyles.detailMetaText}>{detailItinerary.destination}</Text>
                </View>
                <View style={themedStyles.detailMetaItem}>
                  <Ionicons name="flag-outline" size={16} color={colors.primary} />
                  <Text style={themedStyles.detailMetaText}>{detailItinerary.stops} {t('profile.stops')}</Text>
                </View>
                <View style={themedStyles.detailMetaItem}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={themedStyles.detailMetaText}>{detailItinerary.days} {t('profile.days')}</Text>
                </View>
              </View>
              {detailItinerary.saved_at && (
                <Text style={themedStyles.detailSavedAt}>
                  {t('profile.savedAt')}: {new Date(detailItinerary.saved_at).toLocaleDateString()}
                </Text>
              )}
              {/* 重新规划按钮 — 唯一 CTA */}
              <TouchableOpacity
                style={themedStyles.planAgainBtn}
                onPress={() => handlePlanAgain(detailItinerary.destination)}
              >
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={themedStyles.planAgainText}>{t('profile.planAgain')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: FontSize.md,
    color: colors.error,
    marginTop: Spacing.sm,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.text,
  },

  /* ── ScrollView ── */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },

  /* ── Profile Card ── */
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.primaryLight,
  },
  cameraIconWrap: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.full,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  userName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: colors.text,
    marginBottom: Spacing.xs,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  taglineText: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  editProfileBtn: {
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
  },
  editProfileText: {
    color: colors.textOnPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  shareBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: BorderRadius.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Stats Row ── */
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.xl,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  statItemActive: {
    backgroundColor: colors.primaryLight,
  },
  statNumber: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  statNumberActive: {
    color: colors.primary,
  },
  statLabel: {
    fontSize: FontSize.xxs,
    fontWeight: FontWeight.bold,
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.xs,
  },
  statLabelActive: {
    color: colors.primary,
  },

  /* ── Section Header ── */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.text,
  },
  sectionAction: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.primary,
  },

  /* ── Modals ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalCardLarge: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalCloseX: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.text,
    marginBottom: Spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    marginBottom: Spacing.sm,
    backgroundColor: colors.surfaceElevated,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  modalCancel: {
    flex: 1,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    marginRight: Spacing.sm,
    backgroundColor: colors.tag.bg,
    alignItems: 'center',
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  modalSave: {
    flex: 1,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    marginLeft: Spacing.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    color: colors.textOnPrimary,
    fontWeight: FontWeight.semibold,
  },
  modalEmpty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginVertical: Spacing.md,
  },
  alertListItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  deleteInline: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
  },
  deleteInlineText: {
    color: colors.error,
    fontWeight: FontWeight.semibold,
  },

  /* ── Alert Card ── */
  alertCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  emptyAlertCard: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyAlertTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: colors.text,
    marginTop: Spacing.xs,
  },
  emptyAlertDesc: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.tagActive?.border ?? colors.border,
  },
  emptyAlertBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.primary,
  },
  alertIconWrap: {
    backgroundColor: colors.primaryLight,
    borderRadius: BorderRadius.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  alertContent: {
    flex: 1,
  },
  alertRoute: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: colors.text,
  },
  alertTarget: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  alertDropWrap: {
    alignItems: 'flex-end',
  },
  alertDropText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.success,
  },
  alertTodayText: {
    fontSize: FontSize.xxs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  /* ── Itinerary Card ── */
  itineraryCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  itineraryImage: {
    width: '100%',
    height: 160,
    backgroundColor: colors.tag.bg,
  },
  itineraryBookmark: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  itineraryInfo: {
    padding: Spacing.lg,
  },
  itineraryTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.text,
  },
  itineraryMeta: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    marginTop: Spacing.xs,
  },

  /* ── Preferences ── */
  prefRow: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  prefIconWrap: {
    borderRadius: BorderRadius.sm,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: colors.text,
  },
  prefRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  prefValue: {
    fontSize: FontSize.md,
    color: colors.textSecondary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  optionText: {
    fontSize: FontSize.md,
    color: colors.text,
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
    color: colors.textOnPrimary,
    fontSize: FontSize.sm,
  },

  /* ── Itinerary Detail Modal ── */
  detailCoverImage: {
    width: '100%',
    height: 160,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    backgroundColor: colors.tag.bg,
  },
  detailMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: Spacing.md,
  },
  detailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailMetaText: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  detailSavedAt: {
    fontSize: FontSize.sm,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  planAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  planAgainText: {
    color: colors.textOnPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
