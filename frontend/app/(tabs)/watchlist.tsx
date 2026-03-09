/**
 * Tab3 盯盘 — 廉航底价雷达 + 价格提醒 + 邮箱收集（v5 价格提醒功能）
 *
 * 数据源：
 * - 邮箱提交 → POST /v1/leads（后端 Redis 去重 + 计数）
 * - 订阅人数 → GET /v1/leads/stats（实时计数）
 * - 创建提醒 → POST /v1/watchlist/alerts
 * - 查看提醒 → GET /v1/watchlist/alerts?email=...
 *
 * 设计语言：
 * - 暗色 Hero 区带精致雷达动画
 * - 价格提醒卡片：输入起始地、目的地、目标价
 * - 提醒列表展示 + 状态标签
 * - 邮箱区用温暖色调卡片，营造 VIP 感
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Alert,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import {
  submitLeadEmail,
  fetchLeadStats,
  createPriceAlert,
  fetchPriceAlerts,
} from '@/services/api';
import type { PriceAlertItem } from '@/services/types';

/* ── 热门目的地快捷标签 ── */
const POPULAR_ORIGINS = ['上海', '北京', '广州', '深圳', '成都', '杭州'];
const POPULAR_DESTINATIONS = ['东京', '曼谷', '大阪', '首尔', '新加坡', '吉隆坡', '巴厘岛', '清迈'];

export default function WatchlistScreen() {
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

  // ── 雷达动画 ──
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    rotateLoop.start();
    pulseLoop.start();
    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
    };
  }, [rotateAnim, pulseAnim]);

  const rotateSpin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const validateEmail = useCallback((value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }, []);

  /** 邮箱订阅 */
  const handleEmailSubmit = useCallback(async () => {
    if (!email.trim()) {
      setEmailError('请输入邮箱地址');
      return;
    }
    if (!validateEmail(email.trim())) {
      setEmailError('邮箱格式不正确');
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
        setEmailError(resp.message || '提交失败，请稍后再试');
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
    if (!origin.trim()) { setAlertError('请输入出发城市'); return; }
    if (!destination.trim()) { setAlertError('请输入目的地'); return; }
    if (!maxPrice.trim() || isNaN(Number(maxPrice))) { setAlertError('请输入有效的目标价格'); return; }
    if (!trimmedEmail) { setAlertError('请输入邮箱接收提醒'); return; }
    if (!validateEmail(trimmedEmail)) { setAlertError('邮箱格式不正确'); return; }

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
        Alert.alert('提醒创建成功', `当 ${origin.trim()} → ${destination.trim()} 的价格低于 ¥${maxPrice} 时，我们将通过邮件通知你。`);
        setOrigin('');
        setDestination('');
        setMaxPrice('');
        // 刷新列表
        handleLoadAlerts(trimmedEmail);
      }
    } catch {
      setAlertError('创建失败，请稍后再试');
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

      {/* ── 暗色 Hero ── */}
      <View style={styles.hero}>
        <Animated.View
          style={[styles.radarOuter, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.radarMiddle}>
            <Animated.View
              style={[
                styles.radarInner,
                { transform: [{ rotate: rotateSpin }] },
              ]}>
              <View style={styles.radarSweep} />
            </Animated.View>
            <View style={styles.radarCenter}>
              <Ionicons name="radio" size={28} color={Colors.primary} />
            </View>
          </View>
        </Animated.View>

        <View style={styles.scanRow}>
          <View style={styles.scanDot} />
          <Text style={styles.scanText}>
            正在监控全球廉航底价
            {subscriberCount !== null ? ` · ${subscriberCount} 人已订阅` : ''}
          </Text>
        </View>
      </View>

      {/* ── 价格提醒创建 ── */}
      <View style={styles.alertSection}>
        <Text style={styles.sectionTitle}>创建价格提醒</Text>
        <Text style={styles.sectionDesc}>
          设定目标底价，航线降价时第一时间通知你
        </Text>

        <View style={styles.alertCard}>
          {/* 出发地 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>出发城市</Text>
            <TextInput
              style={styles.fieldInput}
              value={origin}
              onChangeText={t => { setOrigin(t); if (alertError) setAlertError(''); }}
              placeholder="如：上海"
              placeholderTextColor={Colors.textLight}
            />
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

          {/* 目的地 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>目的地</Text>
            <TextInput
              style={styles.fieldInput}
              value={destination}
              onChangeText={t => { setDestination(t); if (alertError) setAlertError(''); }}
              placeholder="如：东京"
              placeholderTextColor={Colors.textLight}
            />
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
            <Text style={styles.fieldLabel}>目标价格 (CNY)</Text>
            <View style={styles.priceInputRow}>
              <Text style={styles.pricePrefix}>¥</Text>
              <TextInput
                style={styles.priceInput}
                value={maxPrice}
                onChangeText={t => { setMaxPrice(t.replace(/[^0-9]/g, '')); if (alertError) setAlertError(''); }}
                placeholder="低于此价格时提醒"
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* 邮箱 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>通知邮箱</Text>
            <TextInput
              style={styles.fieldInput}
              value={alertEmail}
              onChangeText={t => { setAlertEmail(t); if (alertError) setAlertError(''); }}
              placeholder="your@email.com"
              placeholderTextColor={Colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
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
                <Text style={styles.createBtnText}>创建降价提醒</Text>
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
              {showAlerts ? '刷新我的提醒' : '查看我的提醒'}
            </Text>
          </TouchableOpacity>
        )}

        {/* 提醒列表 */}
        {showAlerts && (
          <View style={styles.alertsList}>
            {alertsLoading ? (
              <View style={styles.alertsLoadingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.alertsLoadingText}>加载中…</Text>
              </View>
            ) : alerts.length === 0 ? (
              <Text style={styles.alertsEmpty}>暂无价格提醒</Text>
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
                        {alert.status === 'active' ? '监控中' : '已过期'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.alertItemMeta}>
                    <Text style={styles.alertPrice}>目标价 ¥{alert.max_price}</Text>
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

      {/* ── 功能说明 ── */}
      <View style={styles.featureSection}>
        <Text style={styles.featureTitle}>为什么用盯盘</Text>

        <View style={styles.featureGrid}>
          <FeatureCard
            icon="airplane-outline"
            title="底价监控"
            desc="实时扫描东南亚、日韩低价航线"
          />
          <FeatureCard
            icon="git-merge-outline"
            title="中转拼接"
            desc="智能组合多段转机，省出更多预算"
          />
          <FeatureCard
            icon="notifications-outline"
            title="降价提醒"
            desc="目标价位一触即达，推送通知不错过"
          />
          <FeatureCard
            icon="diamond-outline"
            title="早鸟特权"
            desc="留邮箱送 1 个月高级会员"
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
            <Text style={styles.successTitle}>订阅成功</Text>
            <Text style={styles.successDesc}>
              底价雷达上线第一时间通知你{'\n'}同时赠送 1 个月高级会员
            </Text>
          </View>
        ) : (
          <View style={styles.emailCard}>
            <Text style={styles.emailTitle}>抢先体验</Text>
            <Text style={styles.emailSub}>
              留下邮箱，上线即送 1 个月高级会员
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
                  <Text style={styles.submitBtnText}>订阅</Text>
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
          邮箱仅用于产品通知 · 不分享给第三方
        </Text>
        <View style={styles.privacyLinks}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://hacktravel.app/privacy')}>
            <Text style={styles.privacyLink}>隐私政策</Text>
          </TouchableOpacity>
          <Text style={styles.privacyDot}> · </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                '退订',
                '发送邮件至 unsubscribe@hacktravel.app 即可退订',
              )
            }>
            <Text style={styles.privacyLink}>退订说明</Text>
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
    paddingBottom: 100,
  },

  // ── Hero
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    backgroundColor: Colors.secondary,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  radarOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primary + '08',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarMiddle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: 'absolute',
    overflow: 'hidden',
  },
  radarSweep: {
    width: 50,
    height: 50,
    backgroundColor: Colors.primary + '25',
    borderTopRightRadius: 50,
    position: 'absolute',
    top: 0,
    right: 0,
    transformOrigin: 'bottom left',
  },
  radarCenter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.colored(Colors.primary),
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  scanDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: Spacing.sm,
  },
  scanText: {
    color: Colors.textOnDark,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  // ── Alert Section
  alertSection: {
    paddingHorizontal: Spacing.xl,
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
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  alertCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.md,
  },
  fieldGroup: {
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  fieldInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  quickTags: {
    marginTop: Spacing.sm,
  },
  quickTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickTagActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  quickTagText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  quickTagTextActive: {
    color: Colors.primary,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
  },
  pricePrefix: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginRight: Spacing.xs,
  },
  priceInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  alertErrorText: {
    color: Colors.error,
    fontSize: FontSize.xs,
    marginBottom: Spacing.md,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.md,
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

  // ── Alerts List
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
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
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
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  alertStatus: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  alertStatusActive: {
    backgroundColor: Colors.success + '18',
  },
  alertStatusInactive: {
    backgroundColor: Colors.textLight + '18',
  },
  alertStatusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  alertStatusTextActive: {
    color: Colors.success,
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

  // ── Features
  featureSection: {
    padding: Spacing.xl,
  },
  featureTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.3,
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
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  featureCardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  featureCardDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // ── Email
  emailSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  emailCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    ...Shadow.md,
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
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  emailInputErr: {
    borderWidth: 1,
    borderColor: Colors.error,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
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
    color: Colors.error,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },

  // ── Success
  successCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.success + '30',
    ...Shadow.md,
  },
  successTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  successDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Privacy
  privacyRow: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
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
