/**
 * Tab3 盯盘 — 廉航底价雷达 + 邮箱收集（v3 杂志风重构）
 *
 * 设计语言：
 * - 暗色 Hero 区带精致雷达动画
 * - 特性列表用简洁 icon + 文字，不堆 emoji
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

export default function WatchlistScreen() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = useCallback(() => {
    if (!email.trim()) {
      setError('请输入邮箱地址');
      return;
    }
    if (!validateEmail(email.trim())) {
      setError('邮箱格式不正确');
      return;
    }
    // TODO: 对接后端 lead_emails API
    setSubmitted(true);
    setError('');
  }, [email, validateEmail]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}>

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
          <Text style={styles.scanText}>正在监控全球廉航底价</Text>
        </View>
      </View>

      {/* ── 功能说明 ── */}
      <View style={styles.featureSection}>
        <Text style={styles.featureTitle}>底价雷达即将上线</Text>
        <Text style={styles.featureDesc}>
          全球廉航底价监控 + 超长中转拼接算法正在打磨中，留下邮箱抢先体验。
        </Text>

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
        {submitted ? (
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
                style={[styles.emailInput, error ? styles.emailInputErr : {}]}
                value={email}
                onChangeText={text => {
                  setEmail(text);
                  if (error) setError('');
                }}
                placeholder="your@email.com"
                placeholderTextColor={Colors.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
                activeOpacity={0.85}>
                <Text style={styles.submitBtnText}>订阅</Text>
              </TouchableOpacity>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.primary + '08',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarMiddle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: 'absolute',
    overflow: 'hidden',
  },
  radarSweep: {
    width: 60,
    height: 60,
    backgroundColor: Colors.primary + '25',
    borderTopRightRadius: 60,
    position: 'absolute',
    top: 0,
    right: 0,
    transformOrigin: 'bottom left',
  },
  radarCenter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.colored(Colors.primary),
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
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

  // ── Features
  featureSection: {
    padding: Spacing.xl,
  },
  featureTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: Spacing.sm,
  },
  featureDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
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
    ...Shadow.colored(Colors.primary),
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
