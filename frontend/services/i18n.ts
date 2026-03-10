/**
 * HackTravel i18n — 轻量多语言系统
 *
 * 根据设备语言自动选择 zh / en，支持参数插值。
 *
 * 用法：
 *   import { t } from '@/services/i18n';
 *   <Text>{t('plan.heroTitle')}</Text>
 *   <Text>{t('plan.presetUsers', { count: 328 })}</Text>
 */
import { Platform, NativeModules } from 'react-native';

/* ── 获取设备语言 ── */
function getDeviceLocale(): string {
  try {
    if (Platform.OS === 'ios') {
      const settings =
        NativeModules.SettingsManager?.settings ||
        NativeModules.I18nManager;
      const locale =
        settings?.AppleLocale ||
        settings?.AppleLanguages?.[0] ||
        'en';
      return locale;
    }
    if (Platform.OS === 'android') {
      return NativeModules.I18nManager?.localeIdentifier || 'en';
    }
    // web fallback
    if (typeof navigator !== 'undefined') {
      return navigator.language || 'en';
    }
  } catch {
    // ignore
  }
  return 'en';
}

const deviceLocale = getDeviceLocale();
const isZh = deviceLocale.startsWith('zh');

export type Locale = 'zh' | 'en';
export let currentLocale: Locale = isZh ? 'zh' : 'en';

/** 手动切换语言（如设置页面需要） */
export function setLocale(locale: Locale) {
  currentLocale = locale;
}

/* ── 翻译字典 ── */
type TranslationDict = Record<string, string>;

const zh: TranslationDict = {
  // ── Tab Bar ──
  'tab.plan': '规划',
  'tab.guides': '发现',
  'tab.radar': '雷达',
  'tab.profile': '我的',

  // ── Plan 页 (index.tsx) ──
  'plan.budget': '预算',
  'plan.duration': '时长',
  'plan.hours': '小时',
  'plan.heroTitle': '下一站去哪？',
  'plan.heroSub': '找到你的完美旅程',
  'plan.from': '出发地',
  'plan.to': '目的地',
  'plan.fromPlaceholder': '北京',
  'plan.toPlaceholder': '冲绳',
  'plan.continent': '大洲',
  'plan.focusRegion': '目标区域',
  'plan.durationLabel': '时长',
  'plan.budgetLabel': '预算',
  'plan.preferences': '偏好',
  'plan.planMyTrip': '开始规划',
  'plan.planning': '规划中…',
  'plan.hotRoutes': '热门路线',
  'plan.hotRoutesDesc': '点击自动填入参数，秒出路线',
  'plan.hotRoutesRegion': '{region} 热门路线优先展示',
  'plan.presetUsers': '{count} 人抄过',
  'plan.totalDuration': '总时长',
  'plan.estimatedCost': '预计花费',
  'plan.stops': '节点',
  'plan.flashRecommend': '闪电推荐',
  'plan.cacheHit': '极速缓存',
  'plan.aiCustom': 'AI 定制',
  'plan.editRoute': '编辑路线',
  'plan.aiReplan': 'AI 重新规划',
  'plan.localTimeNote': '以下时间均为目的地当地时间 {tz}',
  'plan.addStop': '添加途经点',
  'plan.addStopTitle': '新增途经点',
  'plan.placeName': '地点名称',
  'plan.placeNamePlaceholder': '如：筑地市场',
  'plan.estimatedCostLabel': '预计花费 ¥',
  'plan.attraction': '景点',
  'plan.food': '美食',
  'plan.transit': '交通',
  'plan.shopping': '购物',
  'plan.rest': '住宿',
  'plan.flight': '航班',
  'plan.confirm': '确认添加',
  'plan.cancel': '取消',
  'plan.openMaps': '导入 Google Maps · {count} 个途经点',
  'plan.budgetWarn': '预置路线预估 ¥{estimated} CNY，超出你的预算 ¥{budget} CNY，可手动删除节点或用 AI 重新规划',
  'plan.retry': '重新规划',
  'plan.loadingDefault': '正在生成行程…',
  'plan.noPresetAI': '未找到内置路线，AI 正在专属定制中…',
  'plan.searchBest': '正在搜索最佳路线与隐藏的本地好去处…',
  'plan.smartBudget': '精打细算，让每一分预算都花在刀刃上…',
  'plan.comfortPlan': '规划一条舒适、可执行、省心的完整路线…',
  'plan.everyMinute': '把每一分钟都安排得明明白白…',
  'plan.perfectRoute': '在地图上画出一条完美路线…',
  'plan.rateLimited': '请求太频繁，请 {seconds} 秒后重试',
  'plan.rateLimitedGeneric': '请求太频繁，请稍后重试',
  'plan.modelUnavailable': 'AI 服务暂时不可用，请稍后重试',
  'plan.modelTimeout': 'AI 生成超时，请重试',
  'plan.allModelsFailed': '所有 AI 模型均不可用，请稍后重试',
  'plan.invalidInput': '输入有误：{msg}',
  'plan.schemaError': '参数格式错误，请检查输入',
  'plan.unknownError': '未知错误，请稍后重试',
  'plan.locationDetected': '已定位到 {city}',
  'plan.placeDetailLoading': '正在加载地点详情…',

  // ── Community 页 (community.tsx) ──
  'guides.title': '旅行攻略',
  'guides.live': 'LIVE',
  'guides.liveCount': '{count} 条路线',
  'guides.verified': '精选',
  'guides.hot': '热门',
  'guides.bestSellers': '最多收藏',
  'guides.budget': '省钱',
  'guides.filterBudget': '穷游',
  'guides.filterFoodie': '吃货',
  'guides.filterHiking': '徒步',
  'guides.filterPhoto': '摄影',
  'guides.hours': '{h}H',
  'guides.saves': '{count} 收藏',
  'guides.viewDetails': '查看详情',
  'guides.hideDetails': '收起详情',
  'guides.copyItinerary': '抄作业',
  'guides.navigate': '导航',
  'guides.copying': '复制中…',
  'guides.copySuccess': '已复制到我的行程！',
  'guides.copyFail': '复制失败，请重试',
  'guides.loading': '正在加载攻略…',
  'guides.dataFromAPI': '实时数据',
  'guides.dataFromPreset': '预置数据',
  'guides.placeDetailLoading': '正在加载地点详情…',
  'guides.noResults': '没有找到匹配的路线',
  'guides.resetFilter': '重置筛选',

  // ── Profile 页 (profile.tsx) ──
  'profile.title': '个人中心',
  'profile.editProfile': '编辑资料',
  'profile.editProfileHint': '编辑个人资料功能即将上线',
  'profile.share': '分享',
  'profile.shareHint': '分享个人主页功能即将上线',
  'profile.settings': '设置',
  'profile.settingsHint': '设置页面即将上线',
  'profile.logout': '退出登录',
  'profile.logoutConfirm': '确定要退出登录吗？',
  'profile.countries': '个国家',
  'profile.trips': '行程',
  'profile.saved': '收藏',
  'profile.reviews': '评价',
  'profile.activePriceAlerts': '活跃价格提醒',
  'profile.viewAll': '查看全部',
  'profile.viewAllHint': '查看全部提醒功能即将上线',
  'profile.to': '→',
  'profile.targetPrice': '目标价格',
  'profile.under': '低于',
  'profile.drop': '降价',
  'profile.today': '今日',
  'profile.savedItineraries': '已保存行程',
  'profile.manage': '管理',
  'profile.manageHint': '行程管理功能即将上线',
  'profile.stops': '站',
  'profile.days': '天',
  'profile.personalPreferences': '个人偏好',
  'profile.darkMode': '深色模式',
  'profile.preferredLanguage': '首选语言',
  'profile.defaultCurrency': '默认货币',

  // ── Watchlist 页 (watchlist.tsx) ──
  'radar.scanning': '正在扫描',
  'radar.routes': '条航线',
  'radar.live': 'LIVE',
  'radar.progress': '已监控',
  'radar.subscriberCount': '{count} 人已订阅',
  'radar.createAlert': '创建价格提醒',
  'radar.originLabel': '出发城市',
  'radar.originPlaceholder': '如：上海',
  'radar.destLabel': '目的地',
  'radar.destPlaceholder': '如：东京',
  'radar.maxPrice': '底价阈值 (CNY)',
  'radar.maxPricePlaceholder': '如：1500',
  'radar.emailLabel': '通知邮箱',
  'radar.emailPlaceholder': 'your@email.com',
  'radar.setAlert': '设置提醒',
  'radar.settingAlert': '设置中…',
  'radar.popularOrigins': '热门出发地',
  'radar.popularDests': '热门目的地',
  'radar.myAlerts': '我的提醒',
  'radar.showAlerts': '查看我的提醒',
  'radar.hideAlerts': '收起',
  'radar.noAlerts': '暂无提醒',
  'radar.alertsLoadError': '加载提醒失败',
  'radar.emailSubscribe': '订阅底价推送',
  'radar.emailPlaceholderSub': 'your@email.com',
  'radar.subscribe': '订阅',
  'radar.subscribing': '提交中…',
  'radar.subscribed': '已订阅！',
  'radar.subscribeFail': '订阅失败，请重试',
  'radar.featureTitle': '为什么选择我们？',
  'radar.feature1Title': '实时底价',
  'radar.feature1Desc': '全球 200+ 航线实时扫描',
  'radar.feature2Title': '即时提醒',
  'radar.feature2Desc': '价格触底自动邮件通知',
  'radar.feature3Title': '省钱保障',
  'radar.feature3Desc': '平均为用户节省 ¥800+',
  'radar.feature4Title': '免费使用',
  'radar.feature4Desc': '永久免费，无任何隐藏费用',

  // ── 通用 ──
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.save': '保存',
  'common.close': '关闭',
  'common.loading': '加载中…',
  'common.error': '出错了',
};

const en: TranslationDict = {
  // ── Tab Bar ──
  'tab.plan': 'Plan',
  'tab.guides': 'Guides',
  'tab.radar': 'Radar',
  'tab.profile': 'Profile',

  // ── Plan 页 (index.tsx) ──
  'plan.budget': 'BUDGET',
  'plan.duration': 'DURATION',
  'plan.hours': 'Hours',
  'plan.heroTitle': 'Where to next?',
  'plan.heroSub': 'Find your perfect getaway',
  'plan.from': 'FROM',
  'plan.to': 'TO',
  'plan.fromPlaceholder': 'San Francisco',
  'plan.toPlaceholder': 'Okinawa',
  'plan.continent': 'CONTINENT',
  'plan.focusRegion': 'FOCUS REGION',
  'plan.durationLabel': 'DURATION',
  'plan.budgetLabel': 'BUDGET',
  'plan.preferences': 'PREFERENCES',
  'plan.planMyTrip': 'Plan My Trip',
  'plan.planning': 'Planning…',
  'plan.hotRoutes': 'Popular Routes',
  'plan.hotRoutesDesc': 'Tap to auto-fill and get instant results',
  'plan.hotRoutesRegion': '{region} routes displayed first',
  'plan.presetUsers': '{count} saves',
  'plan.totalDuration': 'DURATION',
  'plan.estimatedCost': 'EST. COST',
  'plan.stops': 'STOPS',
  'plan.flashRecommend': 'Instant',
  'plan.cacheHit': 'Cached',
  'plan.aiCustom': 'AI Custom',
  'plan.editRoute': 'Edit Route',
  'plan.aiReplan': 'AI Re-plan',
  'plan.localTimeNote': 'All times in local destination time {tz}',
  'plan.addStop': 'Add Stop',
  'plan.addStopTitle': 'Add New Stop',
  'plan.placeName': 'Place Name',
  'plan.placeNamePlaceholder': 'e.g. Tsukiji Market',
  'plan.estimatedCostLabel': 'Est. Cost ¥',
  'plan.attraction': 'Attraction',
  'plan.food': 'Food',
  'plan.transit': 'Transit',
  'plan.shopping': 'Shopping',
  'plan.rest': 'Hotel',
  'plan.flight': 'Flight',
  'plan.confirm': 'Confirm',
  'plan.cancel': 'Cancel',
  'plan.openMaps': 'Open in Google Maps · {count} waypoints',
  'plan.budgetWarn': 'Estimated ¥{estimated} CNY exceeds your ¥{budget} CNY budget. Remove stops or AI re-plan.',
  'plan.retry': 'Retry',
  'plan.loadingDefault': 'Generating itinerary…',
  'plan.noPresetAI': 'No preset found, AI is crafting a custom route…',
  'plan.searchBest': 'Searching for the best routes & hidden local gems…',
  'plan.smartBudget': 'Optimizing every dollar of your budget…',
  'plan.comfortPlan': 'Planning a comfortable, actionable trip…',
  'plan.everyMinute': 'Making every minute count…',
  'plan.perfectRoute': 'Drawing the perfect route on the map…',
  'plan.rateLimited': 'Rate limited. Retry in {seconds}s',
  'plan.rateLimitedGeneric': 'Rate limited. Please try later.',
  'plan.modelUnavailable': 'AI service temporarily unavailable',
  'plan.modelTimeout': 'AI generation timed out. Please retry.',
  'plan.allModelsFailed': 'All AI models unavailable. Please try later.',
  'plan.invalidInput': 'Invalid input: {msg}',
  'plan.schemaError': 'Parameter format error. Please check.',
  'plan.unknownError': 'Unknown error. Please try later.',
  'plan.locationDetected': 'Detected: {city}',
  'plan.placeDetailLoading': 'Loading place details…',

  // ── Community 页 (community.tsx) ──
  'guides.title': 'Travel Guides',
  'guides.live': 'LIVE',
  'guides.liveCount': '{count} routes',
  'guides.verified': 'Verified',
  'guides.hot': 'Hot',
  'guides.bestSellers': 'Best Sellers',
  'guides.budget': 'Budget',
  'guides.filterBudget': 'Budget',
  'guides.filterFoodie': 'Foodie',
  'guides.filterHiking': 'Hiking',
  'guides.filterPhoto': 'Photo',
  'guides.hours': '{h}H',
  'guides.saves': '{count} saves',
  'guides.viewDetails': 'View Details',
  'guides.hideDetails': 'Hide Details',
  'guides.copyItinerary': 'Copy Itinerary',
  'guides.navigate': 'Navigate',
  'guides.copying': 'Copying…',
  'guides.copySuccess': 'Copied to my trips!',
  'guides.copyFail': 'Copy failed. Please retry.',
  'guides.loading': 'Loading guides…',
  'guides.dataFromAPI': 'Live data',
  'guides.dataFromPreset': 'Preset data',
  'guides.placeDetailLoading': 'Loading place details…',  'guides.noResults': 'No matching routes found',
  'guides.resetFilter': 'Reset filters',
  // ── Profile 页 (profile.tsx) ──
  'profile.title': 'My Profile',
  'profile.editProfile': 'Edit Profile',
  'profile.editProfileHint': 'Edit profile feature coming soon',
  'profile.share': 'Share',
  'profile.shareHint': 'Share profile feature coming soon',
  'profile.settings': 'Settings',
  'profile.settingsHint': 'Settings page coming soon',
  'profile.logout': 'Log Out',
  'profile.logoutConfirm': 'Are you sure you want to log out?',
  'profile.countries': 'Countries',
  'profile.trips': 'TRIPS',
  'profile.saved': 'SAVED',
  'profile.reviews': 'REVIEWS',
  'profile.activePriceAlerts': 'Active Price Alerts',
  'profile.viewAll': 'View All',
  'profile.viewAllHint': 'View all alerts feature coming soon',
  'profile.to': 'to',
  'profile.targetPrice': 'Target price',
  'profile.under': 'Under',
  'profile.drop': 'drop',
  'profile.today': 'TODAY',
  'profile.savedItineraries': 'Saved Itineraries',
  'profile.manage': 'Manage',
  'profile.manageHint': 'Itinerary management feature coming soon',
  'profile.stops': 'stops',
  'profile.days': 'days',
  'profile.personalPreferences': 'Personal Preferences',
  'profile.darkMode': 'Dark Mode',
  'profile.preferredLanguage': 'Preferred Language',
  'profile.defaultCurrency': 'Default Currency',

  // ── Watchlist 页 (watchlist.tsx) ──
  'radar.scanning': 'Scanning',
  'radar.routes': 'routes',
  'radar.live': 'LIVE',
  'radar.progress': 'Monitored',
  'radar.subscriberCount': '{count} subscribers',
  'radar.createAlert': 'Create Price Alert',
  'radar.originLabel': 'Origin City',
  'radar.originPlaceholder': 'e.g. Shanghai',
  'radar.destLabel': 'Destination',
  'radar.destPlaceholder': 'e.g. Tokyo',
  'radar.maxPrice': 'Max Price (CNY)',
  'radar.maxPricePlaceholder': 'e.g. 1500',
  'radar.emailLabel': 'Notification Email',
  'radar.emailPlaceholder': 'your@email.com',
  'radar.setAlert': 'Set Alert',
  'radar.settingAlert': 'Setting…',
  'radar.popularOrigins': 'Popular Origins',
  'radar.popularDests': 'Popular Destinations',
  'radar.myAlerts': 'My Alerts',
  'radar.showAlerts': 'View My Alerts',
  'radar.hideAlerts': 'Hide',
  'radar.noAlerts': 'No alerts yet',
  'radar.alertsLoadError': 'Failed to load alerts',
  'radar.emailSubscribe': 'Subscribe to Price Drops',
  'radar.emailPlaceholderSub': 'your@email.com',
  'radar.subscribe': 'Subscribe',
  'radar.subscribing': 'Submitting…',
  'radar.subscribed': 'Subscribed!',
  'radar.subscribeFail': 'Subscribe failed. Please retry.',
  'radar.featureTitle': 'Why Choose Us?',
  'radar.feature1Title': 'Real-time Prices',
  'radar.feature1Desc': '200+ global routes scanned live',
  'radar.feature2Title': 'Instant Alerts',
  'radar.feature2Desc': 'Email notification when prices drop',
  'radar.feature3Title': 'Save Money',
  'radar.feature3Desc': 'Average savings of ¥800+ per user',
  'radar.feature4Title': 'Free Forever',
  'radar.feature4Desc': 'No hidden fees, always free',

  // ── 通用 ──
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.loading': 'Loading…',
  'common.error': 'Error',
};

const dictionaries: Record<Locale, TranslationDict> = { zh, en };

/**
 * 翻译函数 — 支持 {key} 参数插值
 *
 * @example t('plan.presetUsers', { count: 328 }) → "328 人抄过" / "328 saves"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = dictionaries[currentLocale] || en;
  let text = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}
