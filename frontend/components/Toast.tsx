/**
 * Toast — 全局轻量浮层提示
 *
 * 在屏幕顶部居中弹出 → 1.5s 自动消失。
 * 替代各页面内的重复 Toast 实现。
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { BorderRadius, FontSize, Spacing, Colors } from '@/constants/Theme';

interface ToastProps {
  /** 为空时隐藏 */
  message: string;
  /** 自动消失后回调 */
  onDismiss: () => void;
  /** 持续时间（ms），默认 1500 */
  duration?: number;
}

export function Toast({ message, onDismiss, duration = 1500 }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  const dismiss = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [onDismiss, opacity]);

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, dismiss, opacity]);

  if (!message) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.card, { opacity }]}>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  card: {
    backgroundColor: 'rgba(17,24,39,0.95)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    maxWidth: '85%',
  },
  text: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.5,
  },
});
