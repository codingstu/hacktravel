/**
 * Tab3 Price Radar — 廉航底价雷达 + 价格提醒 + 邮箱收集（v8 Stitch 统一风格）
 *
 * 数据源：
 * - 邮箱提交 → POST /v1/leads（后端 Redis 去重 + 计数）
 * - 订阅人数 → GET /v1/leads/stats（实时计数）
 * - 创建提醒 → POST /v1/watchlist/alerts
 * - 查看提醒 → GET /v1/watchlist/alerts?email=...
 *
 * 设计语言：Stitch — 圆角 xl 卡片、primary gradient radar、icon-prefix 输入框
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Colors,
  Spacing,
  FontSize,
  FontWeight,
  BorderRadius,
  Shadow,
} from '@/constants/Theme';
import { t } from '@/services/i18n';
import {
  submitLeadEmail,
  fetchLeadStats,
  createPriceAlert,
  fetchPriceAlerts,
} from '@/services/api';
import { RadarScanCard } from '@/components/RadarScanCard';
import type { PriceAlertItem } from '@/services/types';

/* ── 热门目的地快捷标签 ── */
const POPULAR_ORIGINS = ['上海', '北京', '广州', '深圳', '成都', '杭州'];
const POPULAR_DESTINATIONS = ['东京', '曼谷', '大阪', '首尔', '新加坡', '吉隆坡', '巴厘岛', '清迈'];

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  // ── 邮箱订阅 ──
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  // ── 价格提醒 ──
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [alertEmail, setAlertEmail] = useState('');
  const [alertCreating, setAlertCreating] = useState(false);
  const [alertError, setAlertError] = useState('');

  // ── 我的提醒列表 ──
  const [alerts, setAlerts] = useState<PriceAlertItem[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  const validateEmail = useCallback((value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }, []);

  /** 邮箱订阅 */
  const handleEmailSubmit = useCallback(async () => {
    if (!email.trim()) {
      setEmailError(t('radar.subscribeFail'));
      return;
    }
    if (!validateEmail(email.trim())) {
      setEmailError(t('radar.subscribeFail'));
      return;
    }
    setSubmitting(true);
    setEmailError('');
    try {
      const resp = await submitLeadEmail({ email: email.trim() });
      if (resp.success) {
        setEmailSubmitted(true);
        setAlertEmail(email.trim());
        loadStats();
      } else {
        setEmailError(resp.message || t('radar.subscribeFail'));
      }
    } catch {
      setEmailSubmitted(true);
      setAlertEmail(email.trim());
    } finally {
      setSubmitting(false);
    }
  }, [email, validateEmail]);

  /** 创建价格提醒 */
  const handleCreateAlert = useCallback(async () => {
    const trimmedEmail = alertEmail.trim();
    if (!origin.trim()) { setAlertError(t('radar.originPlaceholder')); return; }
    if (!destination.trim()) { setAlertError(t('radar.destPlaceholder')); return; }
    if (!maxPrice.trim() || isNaN(Number(maxPrice))) { setAlertError(t('radar.maxPricePlaceholder')); return; }
    if (!trimmedEmail) { setAlertError(t('radar.emailPlaceholder')); return; }
    if (!validateEmail(trimmedEmail)) { setAlertError(t('radar.subscribeFail')); return; }

    setAlertCreating(true);
    setAlertError('');
    try {
      const resp = await createPriceAlert({
        origin: origin.trim(),
        destination: destination.trim(),
        max_price: Number(maxPrice),
        email: trimmedEmail,
      });
      if (resp.success) {
        Alert.alert(t('radar.setAlert'), `${origin.trim()} → ${destination.trim()} < ¥${maxPrice}`);
        setOrigin('');
        setDestination('');
        setMaxPrice('');
        // 刷新列表
        handleLoadAlerts(trimmedEmail);
      }
    } catch {
      setAlertError(t('radar.subscribeFail'));
    } finally {
      setAlertCreating(false);
    }
  }, [origin, destination, maxPrice, alertEmail, validateEmail]);

  /** 加载我的提醒 */
  const handleLoadAlerts = useCallback(async (emailAddr?: string) => {
    const addr = emailAddr || alertEmail.trim();
    if (!addr) return;
    setAlertsLoading(true);
    setShowAlerts(true);
    try {
      const resp = await fetchPriceAlerts(addr);
      setAlerts(resp.alerts);
    } catch {
      setAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  }, [alertEmail]);

  /** 加载订阅人数 */
  const loadStats = useCallback(async () => {
    try {
      const stats = await fetchLeadStats();
      setSubscriberCount(stats.total_subscribers);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">

      {/* ── Dynamic Radar Hero Card ── */}
      <View style={{ paddingTop: insets.top + Spacing.sm, paddingHorizontal: Spacing.lg }}>
        <RadarScanCard subscriberCount={subscriberCount} />
      </View>

      {/* ── Create Price Alert — Stitch card ── */}
      <View style={styles.alertSection}>
        <Text style={styles.sectionTitle}>{t('radar.createAlert')}</Text>
        <Text style={styles.sectionDesc}>
          {t('radar.feature2Desc')}
        </Text>

        <View style={styles.alertCard}>
          {/* 出发地 — icon prefix input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('radar.originLabel').toUpperCase()}</Text>
            <View style={styles.iconInput}>
              <Ionicons name="airplane-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.iconInputText}
                value={origin}
                onChangeText={val => { setOrigin(val); if (alertError) setAlertError(''); }}
                placeholder={t('radar.originPlaceholder')}
                placeholderTextColor={Colors.textLight}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickTags}>
              {POPULAR_ORIGINS.map(city => (
                <TouchableOpacity
                  key={city}
                  style={[styles.quickTag, origin === city && styles.quickTagActive]}
                  onPress={() => setOrigin(city)}>
                  <Text style={[styles.quickTagText, origin === city && styles.quickTagTextActive]}>{city}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 目的地 — icon prefix input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('radar.destLabel').toUpperCase()}</Text>
            <View style={styles.iconInput}>
              <Ionicons name="locate-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.iconInputText}
                value={destination}
                onChangeText={val => { setDestination(val); if (alertError) setAlertError(''); }}
                placeholder={t('radar.destPlaceholder')}
                placeholderTextColor={Colors.textLight}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickTags}>
              {POPULAR_DESTINATIONS.map(city => (
                <TouchableOpacity
                  key={city}
                  style={[styles.quickTag, destination === city && styles.quickTagActive]}
                  onPress={() => setDestination(city)}>
                  <Text style={[styles.quickTagText, destination === city && styles.quickTagTextActive]}>{city}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 目标价格 */}
          <View style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>{t('radar.maxPrice').toUpperCase()}</Text>
              <Text style={styles.fieldLabelValue}>¥ {maxPrice || '---'}</Text>
            </View>
            <View style={styles.iconInput}>
              <Ionicons name="cash-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.iconInputText}
                value={maxPrice}
                onChangeText={val => { setMaxPrice(val.replace(/[^0-9]/g, '')); if (alertError) setAlertError(''); }}
                placeholder="Alert when below this price"
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* 邮箱 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('radar.emailLabel').toUpperCase()}</Text>
            <View style={styles.iconInput}>
              <Ionicons name="mail-outline" size={20} color={Colors.primary} />
              <TextInput
                style={styles.iconInputText}
                value={alertEmail}
                onChangeText={val => { setAlertEmail(val); if (alertError) setAlertError(''); }}
                placeholder="your@email.com"
                placeholderTextColor={Colors.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {alertError ? <Text style={styles.alertErrorText}>{alertError}</Text> : null}

          <TouchableOpacity
            style={[styles.createBtn, alertCreating && styles.createBtnDisabled]}
            onPress={handleCreateAlert}
            activeOpacity={0.85}
            disabled={alertCreating}>
            {alertCreating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="notifications-outline" size={18} color="#fff" />
                <Text style={styles.createBtnText}>{t('radar.setAlert')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 查看我的提醒 */}
        {!!alertEmail.trim() && validateEmail(alertEmail.trim()) && (
          <TouchableOpacity
            style={styles.viewAlertsBtn}
            onPress={() => handleLoadAlerts()}
            activeOpacity={0.7}>
            <Ionicons name="list-outline" size={16} color={Colors.primary} />
            <Text style={styles.viewAlertsBtnText}>
              {showAlerts ? t('radar.myAlerts') : t('radar.showAlerts')}
            </Text>
          </TouchableOpacity>
        )}

        {/* 提醒列表 */}
        {showAlerts && (
          <View style={styles.alertsList}>
            {alertsLoading ? (
              <View style={styles.alertsLoadingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.alertsLoadingText}>{t('common.loading')}</Text>
              </View>
            ) : alerts.length === 0 ? (
              <Text style={styles.alertsEmpty}>{t('radar.noAlerts')}</Text>
            ) : (
              alerts.map(alert => (
                <View key={alert.alert_id} style={styles.alertItem}>
                  <View style={styles.alertItemHeader}>
                    <View style={styles.alertRoute}>
                      <Ionicons name="airplane-outline" size={14} color={Colors.primary} />
                      <Text style={styles.alertRouteText}>
                        {alert.origin} → {alert.destination}
                      </Text>
                    </View>
                    <View style={[styles.alertStatus, alert.status === 'active' ? styles.alertStatusActive : styles.alertStatusInactive]}>
                      <Text style={[styles.alertStatusText, alert.status === 'active' ? styles.alertStatusTextActive : styles.alertStatusTextInactive]}>
                        {alert.status === 'active' ? 'Active' : 'Expired'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.alertItemMeta}>
                    <Text style={styles.alertPrice}>Target ¥{alert.max_price}</Text>
                    <Text style={styles.alertDate}>
                      {new Date(alert.created_at).toLocaleDateString('zh-CN')}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </View>

      {/* ── Why Price Radar — Stitch 2×2 benefits grid ── */}
      <View style={styles.featureSection}>
        <Text style={styles.featureTitle}>{t('radar.featureTitle')}</Text>

        <View style={styles.featureGrid}>
          <FeatureCard
            icon="trending-down-outline"
            title={t('radar.feature1Title')}
            desc={t('radar.feature1Desc')}
          />
          <FeatureCard
            icon="git-merge-outline"
            title={t('radar.feature2Title')}
            desc={t('radar.feature2Desc')}
          />
          <FeatureCard
            icon="notifications-outline"
            title={t('radar.feature3Title')}
            desc={t('radar.feature3Desc')}
          />
          <FeatureCard
            icon="diamond-outline"
            title={t('radar.feature4Title')}
            desc={t('radar.feature4Desc')}
          />
        </View>
      </View>

      {/* ── 邮箱收集 ── */}
      <View style={styles.emailSection}>
        {emailSubmitted ? (
          <View style={styles.successCard}>
            <Ionicons
              name="checkmark-circle"
              size={44}
              color={Colors.success}
            />
            <Text style={styles.successTitle}>{t('radar.subscribed')}</Text>
            <Text style={styles.successDesc}>
              {t('radar.feature2Desc')}
            </Text>
          </View>
        ) : (
          <View style={styles.emailCard}>
            <Text style={styles.emailTitle}>{t('radar.emailSubscribe')}</Text>
            <Text style={styles.emailSub}>
              {t('radar.feature4Desc')}
            </Text>

            <View style={styles.emailRow}>
              <TextInput
                style={[styles.emailInput, emailError ? styles.emailInputErr : {}]}
                value={email}
                onChangeText={text => {
                  setEmail(text);
                  if (emailError) setEmailError('');
                }}
                placeholder="your@email.com"
                placeholderTextColor={Colors.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleEmailSubmit}
                activeOpacity={0.85}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>{t('radar.subscribe')}</Text>
                )}
              </TouchableOpacity>
            </View>
            {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
          </View>
        )}
      </View>

      {/* ── 隐私 ── */}
      <View style={styles.privacyRow}>
        <Text style={styles.privacyText}>
          Email used for product notifications only
        </Text>
        <View style={styles.privacyLinks}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://hacktravel.app/privacy')}>
            <Text style={styles.privacyLink}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.privacyDot}> · </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Unsubscribe',
                'Send email to unsubscribe@hacktravel.app',
              )
            }>
            <Text style={styles.privacyLink}>Unsubscribe</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIconWrap}>
        <Ionicons name={icon as any} size={20} color={Colors.primary} />
      </View>
      <Text style={styles.featureCardTitle}>{title}</Text>
      <Text style={styles.featureCardDesc}>{desc}</Text>
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

  // ── Alert Section — Stitch card style
  alertSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: Spacing.xs,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  alertCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  fieldGroup: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.textLight,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  fieldLabelValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },

  // ── Icon-prefix inputs — Stitch _3
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    height: 52,
  },
  iconInputText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: FontWeight.medium,
    paddingVertical: 0,
  },
  quickTags: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  quickTag: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.tagActive.bg,
    marginRight: Spacing.xs,
  },
  quickTagActive: {
    backgroundColor: Colors.primary,
  },
  quickTagText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  quickTagTextActive: {
    color: '#fff',
    fontWeight: FontWeight.bold,
  },
  alertErrorText: {
    color: '#dc2626',
    fontSize: FontSize.xs,
    marginBottom: Spacing.md,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: BorderRadius.xl,
    ...Shadow.colored(Colors.primary),
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  viewAlertsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  viewAlertsBtnText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  // ── Alerts List — Stitch card items
  alertsList: {
    marginTop: Spacing.sm,
  },
  alertsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  alertsLoadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  alertsEmpty: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    color: Colors.textLight,
    paddingVertical: Spacing.lg,
  },
  alertItem: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  alertItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  alertRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  alertRouteText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  alertStatus: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  alertStatusActive: {
    backgroundColor: Colors.tagActive.bg,
  },
  alertStatusInactive: {
    backgroundColor: Colors.surfaceElevated,
  },
  alertStatusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  alertStatusTextActive: {
    color: Colors.primary,
  },
  alertStatusTextInactive: {
    color: Colors.textLight,
  },
  alertItemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertPrice: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  alertDate: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },

  // ── Features — Stitch 2×2 grid
  featureSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
    backgroundColor: Colors.tagActive.bg,
    marginTop: Spacing.xl,
  },
  featureTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  featureCard: {
    width: '47%' as any,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    ...Shadow.sm,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.tagActive.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  featureCardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  featureCardDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },

  // ── Email — Stitch card
  emailSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  emailCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    ...Shadow.sm,
  },
  emailTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emailSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  emailRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  emailInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
  },
  emailInputErr: {
    borderColor: '#dc2626',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    ...Shadow.colored(Colors.primary),
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  errorText: {
    color: '#dc2626',
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },

  // ── Success
  successCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.tagActive.border,
    ...Shadow.sm,
  },
  successTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  successDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Privacy
  privacyRow: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  privacyText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginBottom: Spacing.xs,
  },
  privacyLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyLink: {
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  privacyDot: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
});
