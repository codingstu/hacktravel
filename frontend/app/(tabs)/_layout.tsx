/**
 * Tab 导航布局 — 杂志风定制 Tab Bar
 * 去掉 emoji headerTitle，用纯文字 + 极简分割建立品牌感
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/constants/Theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tab.active,
        tabBarInactiveTintColor: Colors.tab.inactive,
        tabBarStyle: {
          backgroundColor: Colors.tab.bg,
          borderTopWidth: 1,
          borderTopColor: Colors.tab.border,
          height: Platform.select({ ios: 78, android: 70 }),
          paddingBottom: Platform.select({ ios: 12, android: 8 }),
          paddingTop: 8,
          borderRadius: BorderRadius.xl,
          marginHorizontal: Spacing.lg,
          marginBottom: Spacing.lg,
          position: 'absolute',
          ...Shadow.lg,
        },
        tabBarItemStyle: {
          borderRadius: BorderRadius.lg,
          marginHorizontal: 4,
        },
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontWeight: FontWeight.semibold,
          letterSpacing: 0.3,
        },
        headerStyle: {
          backgroundColor: Colors.surface,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: Colors.text,
        headerTitleStyle: {
          fontWeight: FontWeight.bold,
          fontSize: FontSize.xl,
          letterSpacing: -0.3,
        },
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '极限爆改',
          headerTitle: '极限爆改',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons
                name={focused ? 'flash' : 'flash-outline'}
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
          title: '抄作业',
          headerTitle: '抄作业',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIconWrap : undefined}>
              <Ionicons
                name={focused ? 'layers' : 'layers-outline'}
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
          title: '盯盘',
          headerTitle: '盯盘',
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconWrap: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
