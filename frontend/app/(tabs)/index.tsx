/**
 * Tab1 极限爆改 – 行程生成主界面
 * 输入表单 → 调 API → 垂直时间轴渲染 → 一键导航
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/Theme';
import { generateItinerary, ApiError } from '@/services/api';
import { TRAVEL_TAGS, HOT_DESTINATIONS, PRESET_ROUTES } from '@/services/presets';
import type {
  ItineraryGenerateResponse,
  ItineraryLeg,
  CommunityRoute,
} from '@/services/types';

type ViewState = 'idle' | 'loading' | 'success' | 'error';

const ACTIVITY_ICONS: Record<string, string> = {
  food: '🍜',
  transit: '🚌',
  attraction: '🏛️',
  rest: '🛏️',
  shopping: '🛍️',
  flight: '✈️',
};

export default function GenerateScreen() {
  // ── Form State ──
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [hours, setHours] = useState('48');
  const [budget, setBudget] = useState('3000');
  const [selectedTags, setSelectedTags] = useState<string[]>(['疯狂暴走']);

  // ── Result State ──
  const [viewState, setViewState] = useState<ViewState>('idle');
  const [result, setResult] = useState<ItineraryGenerateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const scrollRef = useRef<ScrollView>(null);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!destination.trim()) {
      setErrorMsg('请输入目的地');
      setViewState('error');
      return;
    }

    setViewState('loading');
    setErrorMsg('');

    try {
      const resp = await generateItinerary({
        origin: origin.trim() || '出发地',
        destination: destination.trim(),
        total_hours: parseInt(hours, 10) || 48,
        budget: {
          amount: parseInt(budget, 10) || 3000,
          currency: 'CNY',
        },
        tags: selectedTags,
      });
      setResult(resp);
      setViewState('success');

      // 滚动到结果区
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 400, animated: true });
      }, 300);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(`${err.code}: ${err.message}`);
      } else if (err instanceof Error) {
        setErrorMsg(err.name === 'AbortError' ? '请求超时，请重试' : err.message);
      } else {
        setErrorMsg('未知错误，请稍后重试');
      }
      setViewState('error');
    }
  }, [origin, destination, hours, budget, selectedTags]);

  const handleOpenMaps = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  const renderPresetRoute = useCallback(
    (route: CommunityRoute) => (
      <TouchableOpacity
        key={route.id}
        style={styles.presetCard}
        onPress={() => {
          setDestination(route.destination);
          setHours(route.total_hours.toString());
          setBudget(route.budget.amount.toString());
          setSelectedTags(route.tags);
        }}>
        <Text style={styles.presetTitle}>{route.title}</Text>
        <View style={styles.presetMeta}>
          <Text style={styles.presetTag}>⏱ {route.total_hours}H</Text>
          <Text style={styles.presetTag}>💰 ¥{route.budget.amount}</Text>
          <Text style={styles.presetTag}>📋 {route.copy_count}人抄过</Text>
        </View>
      </TouchableOpacity>
    ),
    [],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ── 输入区 ── */}
        <View style={styles.formSection}>
          {/* 出发地 / 目的地 */}
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>出发地</Text>
              <TextInput
                style={styles.input}
                value={origin}
                onChangeText={setOrigin}
                placeholder="如：上海"
                placeholderTextColor={Colors.textLight}
              />
            </View>
            <Ionicons
              name="arrow-forward"
              size={20}
              color={Colors.primary}
              style={{ marginTop: 28, marginHorizontal: Spacing.sm }}
            />
            <View style={styles.inputGroup}>
              <Text style={styles.label}>目的地 *</Text>
              <TextInput
                style={styles.input}
                value={destination}
                onChangeText={setDestination}
                placeholder="如：冲绳"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>

          {/* 热门目的地快捷 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hotDest}>
            {HOT_DESTINATIONS.map(dest => (
              <TouchableOpacity
                key={dest}
                style={[
                  styles.hotChip,
                  destination === dest && styles.hotChipActive,
                ]}
                onPress={() => setDestination(dest)}>
                <Text
                  style={[
                    styles.hotChipText,
                    destination === dest && styles.hotChipTextActive,
                  ]}>
                  {dest}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 时长 / 预算 */}
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>总时长（小时）</Text>
              <TextInput
                style={styles.input}
                value={hours}
                onChangeText={setHours}
                keyboardType="number-pad"
                placeholder="48"
                placeholderTextColor={Colors.textLight}
              />
            </View>
            <View style={[styles.inputGroup, { marginLeft: Spacing.md }]}>
              <Text style={styles.label}>人均预算（¥）</Text>
              <TextInput
                style={styles.input}
                value={budget}
                onChangeText={setBudget}
                keyboardType="number-pad"
                placeholder="3000"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>

          {/* 偏好标签 */}
          <Text style={styles.label}>特种兵偏好</Text>
          <View style={styles.tagRow}>
            {TRAVEL_TAGS.map(tag => (
              <TouchableOpacity
                key={tag.key}
                style={[
                  styles.tagChip,
                  selectedTags.includes(tag.key) && styles.tagChipActive,
                ]}
                onPress={() => toggleTag(tag.key)}>
                <Text
                  style={[
                    styles.tagText,
                    selectedTags.includes(tag.key) && styles.tagTextActive,
                  ]}>
                  {tag.emoji} {tag.key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 生成按钮 */}
          <TouchableOpacity
            style={[styles.generateBtn, viewState === 'loading' && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={viewState === 'loading'}
            activeOpacity={0.8}>
            {viewState === 'loading' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="flash" size={20} color="#fff" />
                <Text style={styles.generateBtnText}>  AI 极限规划</Text>
              </>
            )}
          </TouchableOpacity>

          {viewState === 'loading' && (
            <Text style={styles.loadingHint}>
              🤖 特种兵规划师正在疯狂排兵布阵...
            </Text>
          )}
        </View>

        {/* ── 错误态 ── */}
        {viewState === 'error' && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>😵 {errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleGenerate}>
              <Text style={styles.retryBtnText}>重新规划</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 结果区：时间轴 ── */}
        {viewState === 'success' && result && (
          <View style={styles.resultSection}>
            {/* 汇总大卡片 */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{result.title}</Text>
              <View style={styles.summaryMeta}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {result.summary.total_hours}H
                  </Text>
                  <Text style={styles.summaryLabel}>总时长</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    ¥{result.summary.estimated_total_cost.amount}
                  </Text>
                  <Text style={styles.summaryLabel}>预计花费</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{result.legs.length}</Text>
                  <Text style={styles.summaryLabel}>行程节点</Text>
                </View>
              </View>
              {result.source.cache_hit && (
                <View style={styles.cacheBadge}>
                  <Text style={styles.cacheBadgeText}>⚡ 极速缓存</Text>
                </View>
              )}
            </View>

            {/* 垂直时间轴 */}
            <View style={styles.timeline}>
              {result.legs.map((leg, i) => (
                <TimelineLeg key={i} leg={leg} isLast={i === result.legs.length - 1} />
              ))}
            </View>

            {/* 一键导航按钮 */}
            <TouchableOpacity
              style={styles.mapsBtn}
              onPress={() => handleOpenMaps(result.map.google_maps_deeplink)}
              activeOpacity={0.8}>
              <Ionicons name="navigate" size={22} color="#fff" />
              <Text style={styles.mapsBtnText}>
                一键导入 Google Maps 🗺️ ({result.map.waypoints_count} 个途经点)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 空态：预设路线 ── */}
        {viewState === 'idle' && (
          <View style={styles.presetSection}>
            <Text style={styles.sectionTitle}>🔥 热门路线 · 一键尝鲜</Text>
            <Text style={styles.sectionSubtitle}>
              点击路线自动填入参数，直接体验 AI 规划
            </Text>
            {PRESET_ROUTES.map(renderPresetRoute)}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** 时间轴单节点 */
function TimelineLeg({ leg, isLast }: { leg: ItineraryLeg; isLast: boolean }) {
  const startTime = leg.start_time_local.slice(11, 16);
  const endTime = leg.end_time_local.slice(11, 16);
  const icon = ACTIVITY_ICONS[leg.activity_type] || '📍';

  return (
    <View style={styles.legRow}>
      {/* 时间轴线 */}
      <View style={styles.legTimeline}>
        <View style={styles.legDot} />
        {!isLast && <View style={styles.legLine} />}
      </View>
      {/* 内容 */}
      <View style={[styles.legContent, isLast && { marginBottom: 0 }]}>
        <Text style={styles.legTime}>
          {startTime} - {endTime}
        </Text>
        <Text style={styles.legTitle}>
          {icon} {leg.place.name}
        </Text>
        {leg.transport && (
          <Text style={styles.legTransport}>
            🚗 {leg.transport.mode}
            {leg.transport.reference ? ` · ${leg.transport.reference}` : ''}
          </Text>
        )}
        <Text style={styles.legCost}>
          💰 ¥{leg.estimated_cost.amount}
        </Text>
        {leg.tips && leg.tips.length > 0 && (
          <View style={styles.tipsContainer}>
            {leg.tips.map((tip, i) => (
              <Text key={i} style={styles.tipText}>
                💡 {tip}
              </Text>
            ))}
          </View>
        )}
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
  formSection: {
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  inputGroup: {
    flex: 1,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hotDest: {
    marginBottom: Spacing.md,
  },
  hotChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hotChipActive: {
    backgroundColor: Colors.tag.bg,
    borderColor: Colors.primary,
  },
  hotChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  hotChipTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
  },
  tagChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagChipActive: {
    backgroundColor: Colors.tag.bg,
    borderColor: Colors.primary,
  },
  tagText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  tagTextActive: {
    color: Colors.tag.text,
    fontWeight: '600',
  },
  generateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  generateBtnDisabled: {
    opacity: 0.7,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  loadingHint: {
    textAlign: 'center',
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  // ── Error ──
  errorCard: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  // ── Result ──
  resultSection: {
    paddingHorizontal: Spacing.lg,
  },
  summaryCard: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  summaryMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    color: Colors.primary,
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#334155',
  },
  cacheBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: '#10B98120',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  cacheBadgeText: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  // ── Timeline ──
  timeline: {
    marginBottom: Spacing.lg,
  },
  legRow: {
    flexDirection: 'row',
  },
  legTimeline: {
    width: 24,
    alignItems: 'center',
  },
  legDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.timeline,
    marginTop: 4,
  },
  legLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.timeline + '40',
    marginVertical: 2,
  },
  legContent: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    marginLeft: Spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  legTime: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: FontSize.sm,
  },
  legTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  legTransport: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  legCost: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  tipsContainer: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  // ── Maps Button ──
  mapsBtn: {
    backgroundColor: '#4285F4',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    shadowColor: '#4285F4',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  mapsBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  // ── Presets ──
  presetSection: {
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  presetCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  presetTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  presetMeta: {
    flexDirection: 'row',
  },
  presetTag: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
});
