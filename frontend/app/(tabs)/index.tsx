/**
 * Tab1 极限爆改 — 行程生成主界面（v3 杂志风重构）
 *
 * 设计语言：
 * - 大标题 hero 区 + 奶油白输入卡片 + 暗色结果卡
 * - 去掉 emoji 做标题，改用 icon + 纯文字
 * - 时间轴用色块渐变替代圆点线条
 * - 加载态用个性文案替代通用 spinner 文字
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
  Alert,
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
import { generateItinerary, ApiError } from '@/services/api';
import { TRAVEL_TAGS, HOT_DESTINATIONS, PRESET_ROUTES } from '@/services/presets';
import type {
  ItineraryGenerateResponse,
  ItineraryLeg,
  CommunityRoute,
} from '@/services/types';

type ViewState = 'idle' | 'loading' | 'success' | 'error';

/** 活动类型 → Ionicons 图标映射（替代 emoji） */
const ACTIVITY_ICON_MAP: Record<string, { name: string; color: string }> = {
  food: { name: 'restaurant', color: '#E88A3A' },
  transit: { name: 'bus', color: '#5B8DEF' },
  attraction: { name: 'camera', color: '#A96FDB' },
  rest: { name: 'bed', color: '#6BC5A0' },
  shopping: { name: 'bag-handle', color: '#E86B8A' },
  flight: { name: 'airplane', color: '#5B8DEF' },
};

/** 随机加载文案 — 仅在 AI 生成时展示 */
const LOADING_QUIPS = [
  '未找到内置路线，AI 正在专属定制中…',
  '正在翻遍全网找最便宜的机票…',
  '疯狂计算怎么用最少的钱吃到最多美食…',
  '帮你跟本地人打听哪条巷子值得钻…',
  '把每一分钟都安排得明明白白…',
  '在地图上画出一条完美路线…',
];

export default function GenerateScreen() {
  // ── Form ──
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [hours, setHours] = useState('48');
  const [budget, setBudget] = useState('3000');
  const [selectedTags, setSelectedTags] = useState<string[]>(['疯狂暴走']);

  // ── Result ──
  const [viewState, setViewState] = useState<ViewState>('idle');
  const [result, setResult] = useState<ItineraryGenerateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingQuip, setLoadingQuip] = useState('');

  // ── 可编辑时间轴 ──
  const [editableLegs, setEditableLegs] = useState<ItineraryLeg[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddLeg, setShowAddLeg] = useState(false);
  const [newLegName, setNewLegName] = useState('');
  const [newLegCost, setNewLegCost] = useState('0');
  const [newLegType, setNewLegType] = useState<string>('attraction');

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
    setLoadingQuip(
      LOADING_QUIPS[Math.floor(Math.random() * LOADING_QUIPS.length)],
    );

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
      setEditableLegs(resp.legs);
      setIsEditing(false);
      setShowAddLeg(false);
      setViewState('success');
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

  // ── 编辑时间轴操作 ──
  const moveLegUp = useCallback((i: number) => {
    setEditableLegs(prev => {
      if (i === 0) return prev;
      const arr = [...prev];
      [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
      return arr.map((l, idx) => ({ ...l, index: idx }));
    });
  }, []);

  const moveLegDown = useCallback((i: number) => {
    setEditableLegs(prev => {
      if (i >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
      return arr.map((l, idx) => ({ ...l, index: idx }));
    });
  }, []);

  const deleteLeg = useCallback((i: number) => {
    Alert.alert('删除节点', `确认删除「${editableLegs[i]?.place.name}」?`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: () =>
          setEditableLegs(prev =>
            prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, index: idx }))
          ),
      },
    ]);
  }, [editableLegs]);

  const addLeg = useCallback(() => {
    if (!newLegName.trim()) return;
    const newLeg: ItineraryLeg = {
      index: editableLegs.length,
      start_time_local: '2026-01-01T12:00:00',
      end_time_local: '2026-01-01T14:00:00',
      activity_type: newLegType as any,
      place: { name: newLegName.trim() },
      estimated_cost: { amount: parseInt(newLegCost, 10) || 0, currency: 'CNY' },
      tips: [],
    };
    setEditableLegs(prev => [...prev, newLeg]);
    setNewLegName('');
    setNewLegCost('0');
    setShowAddLeg(false);
  }, [editableLegs.length, newLegName, newLegCost, newLegType]);

  // ── 强制 AI 重新规划 ──
  const handleForceAI = useCallback(async () => {
    if (!destination.trim()) return;
    setViewState('loading');
    setIsEditing(false);
    setErrorMsg('');
    setLoadingQuip('AI 正在专属定制，逐分每颗钱都安排上…');
    try {
      const resp = await generateItinerary({
        origin: origin.trim() || '出发地',
        destination: destination.trim(),
        total_hours: parseInt(hours, 10) || 48,
        budget: { amount: parseInt(budget, 10) || 3000, currency: 'CNY' },
        tags: selectedTags,
        skip_preset: true,
      });
      setResult(resp);
      setEditableLegs(resp.legs);
      setShowAddLeg(false);
      setViewState('success');
      setTimeout(() => scrollRef.current?.scrollTo({ y: 400, animated: true }), 300);
    } catch (err) {
      if (err instanceof ApiError) setErrorMsg(`${err.code}: ${err.message}`);
      else if (err instanceof Error)
        setErrorMsg(err.name === 'AbortError' ? '请求超时，请重试' : err.message);
      else setErrorMsg('未知错误，请稍后重试');
      setViewState('error');
    }
  }, [origin, destination, hours, budget, selectedTags]);

  const fillPreset = useCallback((route: CommunityRoute) => {
    setDestination(route.destination);
    setHours(route.total_hours.toString());
    setBudget(route.budget.amount.toString());
    setSelectedTags(route.tags);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ── Hero 头部 ── */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>去哪儿{'\n'}穷游爆改？</Text>
          <Text style={styles.heroSub}>
            输入目的地，AI 帮你把每分钟、每块钱安排到极致
          </Text>
        </View>

        {/* ── 输入区 ── */}
        <View style={styles.formCard}>
          {/* 出发地 → 目的地 */}
          <View style={styles.routeRow}>
            <View style={styles.routeInput}>
              <Text style={styles.fieldLabel}>FROM</Text>
              <TextInput
                style={styles.input}
                value={origin}
                onChangeText={setOrigin}
                placeholder="上海"
                placeholderTextColor={Colors.textLight}
              />
            </View>
            <View style={styles.routeArrow}>
              <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
            </View>
            <View style={styles.routeInput}>
              <Text style={styles.fieldLabel}>TO</Text>
              <TextInput
                style={[styles.input, styles.inputHighlight]}
                value={destination}
                onChangeText={setDestination}
                placeholder="冲绳"
                placeholderTextColor={Colors.textLight}
              />
            </View>
          </View>

          {/* 热门目的地 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hotScroll}
            contentContainerStyle={styles.hotContent}>
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

          {/* 时长 & 预算 */}
          <View style={styles.paramRow}>
            <View style={styles.paramItem}>
              <Text style={styles.fieldLabel}>时长</Text>
              <View style={styles.paramInputWrap}>
                <TextInput
                  style={styles.paramInput}
                  value={hours}
                  onChangeText={setHours}
                  keyboardType="number-pad"
                  placeholder="48"
                  placeholderTextColor={Colors.textLight}
                />
                <Text style={styles.paramUnit}>小时</Text>
              </View>
            </View>
            <View style={styles.paramDivider} />
            <View style={styles.paramItem}>
              <Text style={styles.fieldLabel}>预算</Text>
              <View style={styles.paramInputWrap}>
                <Text style={styles.paramPrefix}>¥</Text>
                <TextInput
                  style={styles.paramInput}
                  value={budget}
                  onChangeText={setBudget}
                  keyboardType="number-pad"
                  placeholder="3000"
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            </View>
          </View>

          {/* 偏好标签 */}
          <Text style={styles.fieldLabel}>偏好</Text>
          <View style={styles.tagWrap}>
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

          {/* CTA */}
          <TouchableOpacity
            style={[styles.ctaBtn, viewState === 'loading' && styles.ctaBtnLoading]}
            onPress={handleGenerate}
            disabled={viewState === 'loading'}
            activeOpacity={0.85}>
            {viewState === 'loading' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="flash" size={18} color="#fff" />
                <Text style={styles.ctaBtnText}>开始规划</Text>
              </>
            )}
          </TouchableOpacity>

          {viewState === 'loading' && (
            <Text style={styles.loadingQuip}>{loadingQuip}</Text>
          )}
        </View>

        {/* ── 错误态 ── */}
        {viewState === 'error' && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={28} color={Colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleGenerate}>
              <Text style={styles.retryBtnText}>重新规划</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 结果区 ── */}
        {viewState === 'success' && result && (
          <View style={styles.resultArea}>
            {/* 汇总卡 */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{result.title}</Text>
              <View style={styles.summaryRow}>
                <SummaryPill
                  label="总时长"
                  value={`${result.summary.total_hours}h`}
                />
                <SummaryPill
                  label="预计花费"
                  value={`¥${result.summary.estimated_total_cost.amount}`}
                />
                <SummaryPill
                  label="节点"
                  value={`${editableLegs.length}`}
                />
              </View>
              {result.source.is_preset && (
                <View style={styles.presetBadge}>
                  <Ionicons name="flash" size={12} color={Colors.primary} />
                  <Text style={styles.presetBadgeText}>闪电推荐</Text>
                </View>
              )}
              {result.source.cache_hit && !result.source.is_preset && (
                <View style={styles.cacheBadge}>
                  <Ionicons name="flash" size={12} color={Colors.success} />
                  <Text style={styles.cacheBadgeText}>极速缓存</Text>
                </View>
              )}
              {!result.source.cache_hit && !result.source.is_preset && (
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={12} color="#8B5CF6" />
                  <Text style={styles.aiBadgeText}>AI 定制</Text>
                </View>
              )}
            </View>

            {/* 预算警告 */}
            {(() => {
              const estimated = result.summary.estimated_total_cost.amount;
              const userBudget = parseInt(budget, 10) || 0;
              if (userBudget > 0 && estimated > userBudget * 1.2) {
                return (
                  <View style={styles.budgetWarnBanner}>
                    <Ionicons name="warning" size={16} color="#92400E" />
                    <Text style={styles.budgetWarnText}>
                      预置路线预估 ¥{estimated}，超出你的预算 ¥{userBudget}，
                      可手动删除节点或用 AI 重新规划
                    </Text>
                  </View>
                );
              }
              return null;
            })()}

            {/* 操作栏：编辑 + AI 重新规划 */}
            <View style={styles.resultActions}>
              <TouchableOpacity
                style={[styles.actionBtn, isEditing && styles.actionBtnActive]}
                onPress={() => { setIsEditing(v => !v); setShowAddLeg(false); }}>
                <Ionicons
                  name={isEditing ? 'checkmark-circle' : 'create-outline'}
                  size={16}
                  color={isEditing ? '#fff' : Colors.primary}
                />
                <Text style={[styles.actionBtnText, isEditing && styles.actionBtnTextActive]}>
                  {isEditing ? '完成编辑' : '编辑路线'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtnSecondary}
                onPress={handleForceAI}>
                <Ionicons name="sparkles" size={16} color="#8B5CF6" />
                <Text style={styles.actionBtnSecondaryText}>AI 重新规划</Text>
              </TouchableOpacity>
            </View>

            {/* 时间轴 */}
            <View style={styles.timeline}>
              {editableLegs.map((leg, i) => (
                <TimelineLeg
                  key={`${i}-${leg.place.name}`}
                  leg={leg}
                  index={i}
                  isLast={i === editableLegs.length - 1}
                  isEditing={isEditing}
                  canMoveUp={i > 0}
                  canMoveDown={i < editableLegs.length - 1}
                  onMoveUp={() => moveLegUp(i)}
                  onMoveDown={() => moveLegDown(i)}
                  onDelete={() => deleteLeg(i)}
                />
              ))}
            </View>

            {/* 添加途经点 */}
            {isEditing && (
              <View style={styles.addLegSection}>
                {!showAddLeg ? (
                  <TouchableOpacity
                    style={styles.addLegBtn}
                    onPress={() => setShowAddLeg(true)}>
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                    <Text style={styles.addLegBtnText}>添加途经点</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.addLegForm}>
                    <Text style={styles.addLegFormTitle}>✏️ 新增途经点</Text>
                    <TextInput
                      style={styles.addLegInput}
                      value={newLegName}
                      onChangeText={setNewLegName}
                      placeholder="地点名称（如：筑地市场）"
                      placeholderTextColor={Colors.textLight}
                    />
                    <View style={styles.addLegRow}>
                      <View style={styles.addLegCostWrap}>
                        <Text style={styles.addLegLabel}>预计花费 ¥</Text>
                        <TextInput
                          style={styles.addLegCostInput}
                          value={newLegCost}
                          onChangeText={setNewLegCost}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={Colors.textLight}
                        />
                      </View>
                    </View>
                    {/* 活动类型选择 */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginBottom: Spacing.md }}>
                      {[
                        { key: 'attraction', label: '🏛 景点' },
                        { key: 'food', label: '🍜 美食' },
                        { key: 'transit', label: '🚌 交通' },
                        { key: 'shopping', label: '🛍 购物' },
                        { key: 'rest', label: '🏨 住宿' },
                        { key: 'flight', label: '✈️ 航班' },
                      ].map(t => (
                        <TouchableOpacity
                          key={t.key}
                          style={[
                            styles.typeChip,
                            newLegType === t.key && styles.typeChipActive,
                          ]}
                          onPress={() => setNewLegType(t.key)}>
                          <Text
                            style={[
                              styles.typeChipText,
                              newLegType === t.key && styles.typeChipTextActive,
                            ]}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={styles.addLegFormBtns}>
                      <TouchableOpacity
                        style={styles.addLegConfirm}
                        onPress={addLeg}>
                        <Text style={styles.addLegConfirmText}>确认添加</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.addLegCancel}
                        onPress={() => setShowAddLeg(false)}>
                        <Text style={styles.addLegCancelText}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* 导航 CTA */}
            <TouchableOpacity
              style={styles.mapsBtn}
              onPress={() => handleOpenMaps(result.map.google_maps_deeplink)}
              activeOpacity={0.85}>
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.mapsBtnText}>
                导入 Google Maps · {result.map.waypoints_count} 个途经点
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 空态：推荐路线 ── */}
        {viewState === 'idle' && (
          <View style={styles.presetArea}>
            <Text style={styles.sectionLabel}>热门路线</Text>
            <Text style={styles.sectionDesc}>
              对应目的地可秒出路线，点击自动填入参数
            </Text>
            {PRESET_ROUTES.map(route => (
              <TouchableOpacity
                key={route.id}
                style={styles.presetCard}
                onPress={() => fillPreset(route)}
                activeOpacity={0.7}>
                <View style={styles.presetHeader}>
                  <Text style={styles.presetTitle}>{route.title}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.textLight}
                  />
                </View>
                <View style={styles.presetMeta}>
                  <Text style={styles.presetChip}>{route.total_hours}H</Text>
                  <Text style={styles.presetChip}>¥{route.budget.amount}</Text>
                  <Text style={styles.presetChip}>
                    {route.copy_count} 人抄过
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── 子组件 ─── */

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryPillValue}>{value}</Text>
      <Text style={styles.summaryPillLabel}>{label}</Text>
    </View>
  );
}

function TimelineLeg({
  leg,
  index,
  isLast,
  isEditing = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  leg: ItineraryLeg;
  index: number;
  isLast: boolean;
  isEditing?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
}) {
  const startTime = leg.start_time_local.slice(11, 16);
  const endTime = leg.end_time_local.slice(11, 16);
  const iconInfo = ACTIVITY_ICON_MAP[leg.activity_type] || {
    name: 'location',
    color: Colors.primary,
  };

  return (
    <View style={styles.legRow}>
      {/* 左侧时间轴 */}
      <View style={styles.legRail}>
        <View style={[styles.legDot, { backgroundColor: iconInfo.color }]}>
          <Ionicons name={iconInfo.name as any} size={14} color="#fff" />
        </View>
        {!isLast && <View style={styles.legLine} />}
      </View>

      {/* 右侧内容卡 */}
      <View style={[styles.legCard, isLast && { marginBottom: 0 }]}>
        <View style={styles.legCardHeader}>
          <Text style={styles.legTime}>
            {startTime} – {endTime}
          </Text>
          <View style={styles.legCardRight}>
            <Text style={styles.legCost}>¥{leg.estimated_cost.amount}</Text>
            {isEditing && (
              <View style={styles.legEditBtns}>
                <TouchableOpacity
                  style={[styles.legEditBtn, !canMoveUp && styles.legEditBtnDisabled]}
                  onPress={canMoveUp ? onMoveUp : undefined}>
                  <Ionicons name="chevron-up" size={14} color={canMoveUp ? Colors.primary : Colors.textLight} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.legEditBtn, !canMoveDown && styles.legEditBtnDisabled]}
                  onPress={canMoveDown ? onMoveDown : undefined}>
                  <Ionicons name="chevron-down" size={14} color={canMoveDown ? Colors.primary : Colors.textLight} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.legEditBtn, styles.legDeleteBtn]} onPress={onDelete}>
                  <Ionicons name="trash-outline" size={14} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.legPlace}>{leg.place.name}</Text>
        {leg.transport && (
          <Text style={styles.legTransport}>
            {leg.transport.mode}
            {leg.transport.reference ? ` · ${leg.transport.reference}` : ''}
          </Text>
        )}
        {leg.tips && leg.tips.length > 0 && (
          <View style={styles.legTips}>
            {leg.tips.map((tip, i) => (
              <Text key={i} style={styles.legTipText}>
                {tip}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/* ─── 样式 ─── */

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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  heroTitle: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    lineHeight: 42,
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 22,
  },

  // ── Form Card
  formCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    ...Shadow.md,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  routeInput: {
    flex: 1,
  },
  routeArrow: {
    width: 36,
    alignItems: 'center',
    paddingBottom: 10,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },
  inputHighlight: {
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
  },

  // ── Hot destinations
  hotScroll: {
    marginBottom: Spacing.lg,
  },
  hotContent: {
    paddingVertical: Spacing.xs,
  },
  hotChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    marginRight: Spacing.sm,
  },
  hotChipActive: {
    backgroundColor: Colors.primaryLight,
  },
  hotChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  hotChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // ── Params
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  paramItem: {
    flex: 1,
  },
  paramDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  paramInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paramPrefix: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginRight: 2,
  },
  paramInput: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    flex: 1,
    paddingVertical: 2,
  },
  paramUnit: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginLeft: 4,
  },

  // ── Tags
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.xl,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  tagChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
  },
  tagChipActive: {
    backgroundColor: Colors.primaryLight,
  },
  tagText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  tagTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // ── CTA
  ctaBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.colored(Colors.primary),
  },
  ctaBtnLoading: {
    opacity: 0.8,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  loadingQuip: {
    textAlign: 'center',
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
  },

  // ── Error
  errorCard: {
    margin: Spacing.lg,
    padding: Spacing.xl,
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
  },

  // ── Result
  resultArea: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  summaryCard: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.lg,
    letterSpacing: -0.3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryPill: {
    alignItems: 'center',
    flex: 1,
  },
  summaryPillValue: {
    color: Colors.accent,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.heavy,
  },
  summaryPillLabel: {
    color: Colors.textOnDark,
    fontSize: FontSize.xs,
    marginTop: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cacheBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2ABF6E18',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  cacheBadgeText: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  presetBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}18`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  presetBadgeText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  aiBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF618',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  aiBadgeText: {
    color: '#8B5CF6',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  // ── Timeline
  timeline: {
    marginBottom: Spacing.lg,
  },
  legRow: {
    flexDirection: 'row',
  },
  legRail: {
    width: 32,
    alignItems: 'center',
  },
  legDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  legLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.divider,
    marginVertical: 2,
  },
  legCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    marginLeft: Spacing.sm,
    ...Shadow.sm,
  },
  legCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  legCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legEditBtns: {
    flexDirection: 'row',
    gap: 2,
    marginLeft: Spacing.xs,
  },
  legEditBtn: {
    width: 26,
    height: 26,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legEditBtnDisabled: {
    opacity: 0.35,
  },
  legDeleteBtn: {
    backgroundColor: '#FEF2F2',
  },
  legTime: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.sm,
    letterSpacing: 0.3,
  },
  legCost: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.sm,
  },
  legPlace: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: 4,
    lineHeight: 24,
  },
  legTransport: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  legTips: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  legTipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── Maps
  mapsBtn: {
    backgroundColor: '#1A73E8',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
    ...Shadow.colored('#1A73E8'),
  },
  mapsBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },

  // ── Budget warning
  budgetWarnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  budgetWarnText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#92400E',
    lineHeight: 20,
  },

  // ── Result action bar
  resultActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  actionBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  actionBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  actionBtnTextActive: {
    color: '#fff',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: '#8B5CF6',
    backgroundColor: Colors.surface,
  },
  actionBtnSecondaryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#8B5CF6',
  },

  // ── Add Leg
  addLegSection: {
    marginBottom: Spacing.lg,
  },
  addLegBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  addLegBtnText: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.md,
  },
  addLegForm: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadow.md,
  },
  addLegFormTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  addLegInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  addLegRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  addLegCostWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  addLegLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  addLegCostInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    width: 80,
  },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    marginRight: Spacing.sm,
  },
  typeChipActive: {
    backgroundColor: Colors.primaryLight,
  },
  typeChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  typeChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  addLegFormBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addLegConfirm: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  addLegConfirmText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  addLegCancel: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  addLegCancelText: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.md,
  },

  // ── Presets
  presetArea: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: Spacing.xs,
  },
  sectionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  presetCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  presetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  presetTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    flex: 1,
  },
  presetMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  presetChip: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
    fontWeight: FontWeight.medium,
    overflow: 'hidden',
  },
});
