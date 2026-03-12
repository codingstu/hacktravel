/**
 * DisclaimerBanner — 行程结果页底部地区感知免责提示
 *
 * 根据用户选择的大洲 + 当前语言，展示不同推荐平台的小字提示。
 * 当后端 policy.disclaimer 非空时优先使用后端文案。
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/Theme';
import { getDisclaimer } from '@/services/disclaimer';
import { currentLocale } from '@/services/i18n';
import type { Continent } from '@/services/types';

interface DisclaimerBannerProps {
  continent?: Continent;
  /** 后端 policy.disclaimer 值，优先于本地映射 */
  serverDisclaimer?: string;
}

export function DisclaimerBanner({ continent, serverDisclaimer }: DisclaimerBannerProps) {
  const text = getDisclaimer(continent, currentLocale, serverDisclaimer);

  return (
    <View style={styles.container}>
      <View style={styles.divider} />
      <View style={styles.content}>
        <Ionicons name="information-circle-outline" size={14} color={Colors.textLight} style={styles.icon} />
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginBottom: Spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.6,
    color: Colors.textLight,
    letterSpacing: 0.1,
  },
});
