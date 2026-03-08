/**
 * Tab3 盯盘 – 廉航底价雷达 + 邮箱收集
 * 蓝图 Section 6.3：雷达动画 + 邮箱收集表单 + 隐私说明
 * 目标：收集高意向种子用户，为 Google Play 20 人封测储备
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
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/Theme';

export default function WatchlistScreen() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // ── 雷达动画 ──
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 旋转动画
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    // 脉冲动画
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
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
      setError('请输入有效的邮箱地址');
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
      {/* ── 雷达动画区 ── */}
      <View style={styles.radarSection}>
        <Animated.View
          style={[styles.radarOuter, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.radarMiddle}>
            <Animated.View
              style={[styles.radarInner, { transform: [{ rotate: rotateSpin }] }]}>
              <View style={styles.radarSweep} />
            </Animated.View>
            <View style={styles.radarCenter}>
              <Ionicons name="radio" size={32} color={Colors.primary} />
            </View>
          </View>
        </Animated.View>

        {/* 扫描状态文字 */}
        <View style={styles.scanStatus}>
          <View style={styles.scanDot} />
          <Text style={styles.scanText}>正在监控全球廉航底价...</Text>
        </View>
      </View>

      {/* ── 功能说明 ── */}
      <View style={styles.featureSection}>
        <Text style={styles.featureTitle}>🛫 底价雷达即将上线</Text>
        <Text style={styles.featureDesc}>
          全球廉航（亚航 / 越捷 / 酷航 / 春秋）底价监控系统及超长中转拼接算法正在升级中…
        </Text>

        <View style={styles.featureList}>
          <FeatureItem
            icon="airplane"
            title="底价监控"
            desc="实时扫描东南亚、日韩低价航线"
          />
          <FeatureItem
            icon="git-merge"
            title="超长中转拼接"
            desc="智能组合多段转机，省出更多预算"
          />
          <FeatureItem
            icon="notifications"
            title="降价提醒"
            desc="目标价位一触即达，推送通知不错过"
          />
          <FeatureItem
            icon="trophy"
            title="早鸟特权"
            desc="留下邮箱，上线送 1 个月高级会员"
          />
        </View>
      </View>

      {/* ── 邮箱收集 ── */}
      <View style={styles.emailSection}>
        {submitted ? (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
            </View>
            <Text style={styles.successTitle}>订阅成功！🎉</Text>
            <Text style={styles.successDesc}>
              底价雷达上线第一时间通知你，{'\n'}同时赠送 1 个月高级会员
            </Text>
          </View>
        ) : (
          <View style={styles.emailCard}>
            <Text style={styles.emailTitle}>抢先体验底价雷达</Text>
            <Text style={styles.emailSubtitle}>
              留下邮箱，上线送 1 个月高级会员
            </Text>

            <View style={styles.emailInputRow}>
              <TextInput
                style={[styles.emailInput, error ? styles.emailInputError : {}]}
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
                activeOpacity={0.8}>
                <Text style={styles.submitBtnText}>订阅</Text>
              </TouchableOpacity>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        )}
      </View>

      {/* ── 隐私说明 ── */}
      <View style={styles.privacySection}>
        <Text style={styles.privacyText}>
          📌 你的邮箱仅用于产品通知，不会分享给第三方。
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://hacktravel.app/privacy')}>
          <Text style={styles.privacyLink}>隐私政策</Text>
        </TouchableOpacity>
        <Text style={styles.privacyText}> | </Text>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('退订', '发送邮件至 unsubscribe@hacktravel.app 即可退订');
          }}>
          <Text style={styles.privacyLink}>退订说明</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function FeatureItem({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        <Ionicons name={icon as any} size={22} color={Colors.primary} />
      </View>
      <View style={styles.featureTextContainer}>
        <Text style={styles.featureItemTitle}>{title}</Text>
        <Text style={styles.featureItemDesc}>{desc}</Text>
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
  // ── Radar ──
  radarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    backgroundColor: Colors.secondary,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  radarOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarMiddle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    position: 'absolute',
    overflow: 'hidden',
  },
  radarSweep: {
    width: 70,
    height: 70,
    backgroundColor: Colors.primary + '30',
    borderTopRightRadius: 70,
    position: 'absolute',
    top: 0,
    right: 0,
    transformOrigin: 'bottom left',
  },
  radarCenter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  scanStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  scanDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginRight: Spacing.sm,
  },
  scanText: {
    color: '#94A3B8',
    fontSize: FontSize.sm,
  },
  // ── Features ──
  featureSection: {
    padding: Spacing.xl,
  },
  featureTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  featureDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  featureList: {
    gap: Spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.tag.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureItemTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  featureItemDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  // ── Email ──
  emailSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  emailCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.primary + '20',
  },
  emailTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emailSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  emailInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  emailInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emailInputError: {
    borderColor: Colors.error,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  // ── Success ──
  successCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.success + '30',
  },
  successIcon: {
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  successDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // ── Privacy ──
  privacySection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  privacyText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  privacyLink: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});
