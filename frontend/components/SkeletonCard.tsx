/**
 * SkeletonCard — 骨架屏占位卡片
 *
 * 用于行程生成加载期间的占位渲染，替代纯 spinner。
 * 支持自定义行数和布局，默认模拟行程时间轴卡片。
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';

interface SkeletonCardProps {
  /** 骨架行数，默认 3 */
  lines?: number;
  /** 是否显示头像/icon 占位，默认 true */
  showAvatar?: boolean;
}

function SkeletonLine({ width, height = 12 }: { width: string | number; height?: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, easing: Easing.ease, useNativeDriver: true }),
      ]),
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[
        styles.line,
        { width: width as any, height, opacity },
      ]}
    />
  );
}

export function SkeletonCard({ lines = 3, showAvatar = true }: SkeletonCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {showAvatar && <View style={styles.avatar}><SkeletonLine width={28} height={28} /></View>}
        <View style={styles.body}>
          <SkeletonLine width="60%" height={14} />
          <SkeletonLine width="40%" height={10} />
        </View>
        <SkeletonLine width={50} height={14} />
      </View>
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <View key={i} style={styles.extraRow}>
          <SkeletonLine width={`${70 - i * 15}%`} height={10} />
        </View>
      ))}
    </View>
  );
}

/** 行程加载骨架屏：汇总卡 + 3 个时间轴骨架 */
export function ItinerarySkeleton() {
  return (
    <View style={styles.container}>
      {/* 汇总卡骨架 */}
      <View style={styles.summaryCard}>
        <SkeletonLine width="50%" height={18} />
        <View style={styles.summaryRow}>
          <SkeletonLine width={80} height={12} />
          <SkeletonLine width={80} height={12} />
          <SkeletonLine width={60} height={12} />
        </View>
      </View>
      {/* 时间轴骨架 */}
      {[1, 2, 3].map(i => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  summaryCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    gap: Spacing.xs,
  },
  extraRow: {
    paddingLeft: 40,
  },
  line: {
    backgroundColor: Colors.border,
    borderRadius: BorderRadius.xs,
  },
});
