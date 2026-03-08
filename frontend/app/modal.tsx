/**
 * Modal – 路线详情（从卡片跳转时使用）
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Theme';

export default function ModalScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.placeholder}>
        <Text style={styles.emoji}>🗺️</Text>
        <Text style={styles.title}>路线详情</Text>
        <Text style={styles.desc}>此功能将在后续版本中上线</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  emoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  desc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
});
