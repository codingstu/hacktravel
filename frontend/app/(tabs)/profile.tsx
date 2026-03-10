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
 * 当前为前端 Mock 数据展示，后续接入用户系统后替换为真实数据。
 */
import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Spacing,
  FontSize,
  FontWeight,
  BorderRadius,
  Shadow,
} from '@/constants/Theme';
import { t } from '@/services/i18n';
import { getDestinationImage } from '@/services/images';

/* ── Mock 用户数据 ── */
const MOCK_USER = {
  name: 'Alex Rivers',
  tagline: 'Travel Enthusiast',
  countriesVisited: 12,
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format&q=80',
  stats: {
    trips: 14,
    saved: 8,
    reviews: 22,
  },
};

/* ── Mock 价格提醒 ── */
const MOCK_PRICE_ALERTS = [
  {
    id: '1',
    origin: 'London',
    destination: 'Tokyo',
    targetPrice: 850,
    currency: 'USD',
    drop: 120,
    isToday: true,
  },
];

/* ── Mock 已保存行程 ── */
const MOCK_SAVED_ITINERARIES = [
  {
    id: '1',
    title: 'West Coast Roadtrip',
    stops: 12,
    days: 14,
    destination: '洛杉矶',
  },
  {
    id: '2',
    title: 'National Parks Hiking',
    stops: 5,
    days: 7,
    destination: '温哥华',
  },
];

/* ── 偏好设置选项 ── */
const LANGUAGE_OPTIONS = ['English', '中文', '日本語', '한국어'];
const CURRENCY_OPTIONS = ['USD ($)', 'CNY (¥)', 'JPY (¥)', 'EUR (€)', 'GBP (£)'];

type ViewState = 'idle' | 'loading' | 'error';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  // ── 偏好设置状态 ──
  const [darkMode, setDarkMode] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [selectedCurrency, setSelectedCurrency] = useState('USD ($)');
  const [viewState] = useState<ViewState>('idle');

  // ── 事件处理 ──
  const handleEditProfile = useCallback(() => {
    Alert.alert(t('profile.editProfile'), t('profile.editProfileHint'));
  }, []);

  const handleShare = useCallback(() => {
    Alert.alert(t('profile.share'), t('profile.shareHint'));
  }, []);

  const handleSettings = useCallback(() => {
    Alert.alert(t('profile.settings'), t('profile.settingsHint'));
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('plan.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => {} },
    ]);
  }, []);

  const handleViewAllAlerts = useCallback(() => {
    Alert.alert(t('profile.viewAll'), t('profile.viewAllHint'));
  }, []);

  const handleManageItineraries = useCallback(() => {
    Alert.alert(t('profile.manage'), t('profile.manageHint'));
  }, []);

  const handleLanguageSelect = useCallback(() => {
    Alert.alert(
      t('profile.preferredLanguage'),
      undefined,
      LANGUAGE_OPTIONS.map(lang => ({
        text: lang,
        onPress: () => setSelectedLanguage(lang),
      })),
    );
  }, []);

  const handleCurrencySelect = useCallback(() => {
    Alert.alert(
      t('profile.defaultCurrency'),
      undefined,
      CURRENCY_OPTIONS.map(cur => ({
        text: cur,
        onPress: () => setSelectedCurrency(cur),
      })),
    );
  }, []);

  // ── 空态 / 加载态 / 错误态 ──
  if (viewState === 'loading') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </View>
    );
  }

  if (viewState === 'error') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.errorText}>{t('common.error')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── 顶部标题栏 ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSettings} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="settings-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        <TouchableOpacity onPress={handleLogout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="log-out-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 用户头像卡片 ── */}
        <View style={[styles.profileCard, Shadow.md]}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: MOCK_USER.avatarUrl }}
              style={styles.avatar}
            />
            <View style={styles.cameraIconWrap}>
              <Ionicons name="camera" size={14} color={Colors.textOnPrimary} />
            </View>
          </View>
          <Text style={styles.userName}>{MOCK_USER.name}</Text>
          <View style={styles.taglineRow}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
            <Text style={styles.taglineText}>
              {MOCK_USER.tagline} • {MOCK_USER.countriesVisited} {t('profile.countries')}
            </Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.editProfileBtn} onPress={handleEditProfile}>
              <Text style={styles.editProfileText}>{t('profile.editProfile')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 统计数据栏 ── */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{MOCK_USER.stats.trips}</Text>
            <Text style={styles.statLabel}>{t('profile.trips')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{MOCK_USER.stats.saved}</Text>
            <Text style={styles.statLabel}>{t('profile.saved')}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{MOCK_USER.stats.reviews}</Text>
            <Text style={styles.statLabel}>{t('profile.reviews')}</Text>
          </View>
        </View>

        {/* ── Active Price Alerts ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('profile.activePriceAlerts')}</Text>
          <TouchableOpacity onPress={handleViewAllAlerts}>
            <Text style={styles.sectionAction}>{t('profile.viewAll')}</Text>
          </TouchableOpacity>
        </View>
        {MOCK_PRICE_ALERTS.map(alert => (
          <View key={alert.id} style={[styles.alertCard, Shadow.sm]}>
            <View style={styles.alertIconWrap}>
              <Ionicons name="notifications-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertRoute}>
                {alert.origin} {t('profile.to')} {alert.destination}
              </Text>
              <Text style={styles.alertTarget}>
                {t('profile.targetPrice')}: {t('profile.under')} ${alert.targetPrice}
              </Text>
            </View>
            <View style={styles.alertDropWrap}>
              <Text style={styles.alertDropText}>
                -${alert.drop} {t('profile.drop')}
              </Text>
              {alert.isToday && (
                <Text style={styles.alertTodayText}>{t('profile.today')}</Text>
              )}
            </View>
          </View>
        ))}

        {/* ── Saved Itineraries ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('profile.savedItineraries')}</Text>
          <TouchableOpacity onPress={handleManageItineraries}>
            <Text style={styles.sectionAction}>{t('profile.manage')}</Text>
          </TouchableOpacity>
        </View>
        {MOCK_SAVED_ITINERARIES.map(itinerary => (
          <View key={itinerary.id} style={[styles.itineraryCard, Shadow.sm]}>
            <Image
              source={{ uri: getDestinationImage(itinerary.destination, 800, 400) }}
              style={styles.itineraryImage}
            />
            <TouchableOpacity style={styles.itineraryBookmark}>
              <Ionicons name="bookmark" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <View style={styles.itineraryInfo}>
              <Text style={styles.itineraryTitle}>{itinerary.title}</Text>
              <Text style={styles.itineraryMeta}>
                {itinerary.stops} {t('profile.stops')} • {itinerary.days} {t('profile.days')}
              </Text>
            </View>
          </View>
        ))}

        {/* ── Personal Preferences ── */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl, marginBottom: Spacing.md }]}>
          {t('profile.personalPreferences')}
        </Text>

        {/* Dark Mode */}
        <View style={[styles.prefRow, Shadow.sm]}>
          <View style={styles.prefLeft}>
            <View style={[styles.prefIconWrap, { backgroundColor: '#1E293B' }]}>
              <Ionicons name="moon" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.prefLabel}>{t('profile.darkMode')}</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: Colors.tag.bg, true: Colors.primary }}
            thumbColor={Colors.surface}
            ios_backgroundColor={Colors.tag.bg}
          />
        </View>

        {/* Preferred Language */}
        <TouchableOpacity style={[styles.prefRow, Shadow.sm]} onPress={handleLanguageSelect}>
          <View style={styles.prefLeft}>
            <View style={[styles.prefIconWrap, { backgroundColor: Colors.primary }]}>
              <Ionicons name="globe-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.prefLabel}>{t('profile.preferredLanguage')}</Text>
          </View>
          <View style={styles.prefRight}>
            <Text style={styles.prefValue}>{selectedLanguage}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </View>
        </TouchableOpacity>

        {/* Default Currency */}
        <TouchableOpacity style={[styles.prefRow, Shadow.sm]} onPress={handleCurrencySelect}>
          <View style={styles.prefLeft}>
            <View style={[styles.prefIconWrap, { backgroundColor: Colors.primary }]}>
              <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.prefLabel}>{t('profile.defaultCurrency')}</Text>
          </View>
          <View style={styles.prefRight}>
            <Text style={styles.prefValue}>{selectedCurrency}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.error,
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
    color: Colors.text,
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
    backgroundColor: Colors.surface,
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
    borderColor: Colors.primaryLight,
  },
  cameraIconWrap: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  userName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
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
    color: Colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  editProfileBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
  },
  editProfileText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  shareBtn: {
    backgroundColor: Colors.primaryLight,
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
  },
  statNumber: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  statLabel: {
    fontSize: FontSize.xxs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.xs,
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
    color: Colors.text,
  },
  sectionAction: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },

  /* ── Alert Card ── */
  alertCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  alertIconWrap: {
    backgroundColor: Colors.primaryLight,
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
    color: Colors.text,
  },
  alertTarget: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  alertDropWrap: {
    alignItems: 'flex-end',
  },
  alertDropText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.success,
  },
  alertTodayText: {
    fontSize: FontSize.xxs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  /* ── Itinerary Card ── */
  itineraryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  itineraryImage: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.tag.bg,
  },
  itineraryBookmark: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.surface,
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
    color: Colors.text,
  },
  itineraryMeta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  /* ── Preferences ── */
  prefRow: {
    backgroundColor: Colors.surface,
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
    color: Colors.text,
  },
  prefRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  prefValue: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});
