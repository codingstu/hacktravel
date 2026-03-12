/**
 * Avatar 头像组件 — 根据用户名自动生成
 * 
 * 参考 Google / Telegram 风格：
 * - 从用户名取首字母（支持中文）
 * - 根据名字哈希生成背景色
 * - 支持传入自定义头像 URL
 */
import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { FontWeight } from '@/constants/Theme';

interface AvatarProps {
  name: string;
  size?: number;
  imageUrl?: string | null;
  style?: object;
}

// 柔和的配色方案（参考 Google / Telegram）
const AVATAR_COLORS = [
  '#FF6B6B', // 红
  '#FF8E53', // 橙
  '#FFB347', // 杏
  '#87D68D', // 绿
  '#4ECDC4', // 青
  '#45B7D1', // 蓝
  '#5C7CFA', // 靛
  '#7950F2', // 紫
  '#E64980', // 粉
  '#20C997', // 薄荷
  '#748FFC', // 天蓝
  '#F06595', // 玫红
];

/**
 * 从字符串生成稳定的哈希值用于选取颜色
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 获取名字的首字母/首字
 * - 英文：取首字母大写
 * - 中文：取第一个汉字
 * - 多个单词：取每个单词首字母（最多2个）
 */
function getInitials(name: string): string {
  if (!name || name.trim().length === 0) {
    return '?';
  }

  const trimmed = name.trim();
  
  // 检测是否包含中文字符
  const chineseMatch = trimmed.match(/[\u4e00-\u9fa5]/);
  if (chineseMatch) {
    // 中文名取第一个汉字
    return chineseMatch[0];
  }

  // 英文名处理
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) {
    return '?';
  }
  
  if (words.length === 1) {
    // 单词取首字母
    return words[0].charAt(0).toUpperCase();
  }
  
  // 多个单词取前两个单词的首字母
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/**
 * 根据名字生成背景色
 */
function getAvatarColor(name: string): string {
  const hash = hashString(name.toLowerCase().trim());
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function Avatar({ name, size = 48, imageUrl, style }: AvatarProps) {
  const initials = useMemo(() => getInitials(name), [name]);
  const backgroundColor = useMemo(() => getAvatarColor(name), [name]);
  const fontSize = Math.round(size * 0.42);
  
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor,
  };

  // 如果有自定义头像 URL，显示图片
  if (imageUrl && imageUrl.length > 0) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, containerStyle, style]}
        defaultSource={require('@/assets/images/icon.png')}
      />
    );
  }

  // 否则显示首字母头像
  return (
    <View style={[styles.container, containerStyle, style]}>
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  image: {
    resizeMode: 'cover',
  },
});

export default Avatar;
