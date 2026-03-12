/**
 * Tab 导航布局 — 对齐 Stitch 设计稿
 * 底部 4 Tab：Plan / Guides / Radar / Profile
 * 半透明毛玻璃底栏 + primary/10 色圈
 * 适配全面屏手机 / 移动端网页 / 桌面网页底部安全区
 *
 * 兼容策略：
 * - iOS/Android 原生：useSafeAreaInsets 动态获取 bottom inset
 * - Web（桌面/移动）：最小 padding 保证文字可见，env(safe-area-inset-bottom) 由 +html.tsx 处理
 * - 全面屏手势导航横条（20-34pt）通过 Math.max 保底
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontWeight, BorderRadius } from '@/constants/Theme';

/** 各平台最小底部安全 padding（保证标签文字不被裁切） */
const MIN_BOTTOM_PADDING = Platform.select({ ios: 24, android: 16, web: 8, default: 12 });
/** tab 内容区域高度（图标 + 文字 + 内部间距） */
const TAB_CONTENT_HEIGHT = 56;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // 取 insets.bottom 与平台最小值中较大者，确保全面屏和普通设备都安全
  const bottomPadding = Math.max(insets.bottom, MIN_BOTTOM_PADDING);
  const tabBarHeight = TAB_CONTENT_HEIGHT + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tab.active,
        tabBarInactiveTintColor: Colors.tab.inactive,
        tabBarStyle: {
          backgroundColor: Colors.tab.bg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: Colors.tab.border,
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          // Web 端确保 tab bar 不会被视口底部截断
          ...Platform.select({
            web: {
              position: 'sticky' as const,
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 100,
            },
            default: {},
          }),
        },
        tabBarItemStyle: {
          marginHorizontal: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons
                name={focused ? 'map' : 'map-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Guides',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons
                name={focused ? 'book' : 'book-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Radar',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons
                name={focused ? 'radio' : 'radio-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconWrap: {
    backgroundColor: Colors.tagActive.bg,
    borderRadius: BorderRadius.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
