"""Preset routes library — instant response for popular global destinations.

Architecture: user clicks "开始规划" → preset lookup (0ms) → cache (1ms) → LLM (10-60s)
This eliminates the long wait for 80%+ of popular queries, dramatically improving UX.

Matching logic:
  1. Destination fuzzy match (aliases, case-insensitive)
  2. Hours tolerance: ±50% (e.g., 48h query matches 24h-72h presets)
  3. Budget tolerance: ±50%
  4. Tags: bonus scoring but not required
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from app.models.itinerary import (
    ItineraryGenerateResponse,
    ItineraryLeg,
    ItinerarySummary,
    MapInfo,
    Money,
    Place,
    SourceInfo,
    Transport,
)
from app.utils.google_maps import build_google_maps_url

logger = logging.getLogger(__name__)

# ── Destination aliases ──────────────────────────────────

_DEST_ALIASES: dict[str, str] = {
    # Japanese
    "okinawa": "冲绳",
    "冲繩": "冲绳",
    "那霸": "冲绳",
    "tokyo": "东京",
    "東京": "东京",
    "osaka": "大阪",
    "大坂": "大阪",
    "kyoto": "京都",
    # Southeast Asia
    "bangkok": "曼谷",
    "ho chi minh": "胡志明市",
    "hcmc": "胡志明市",
    "saigon": "胡志明市",
    "西贡": "胡志明市",
    "singapore": "新加坡",
    "坡县": "新加坡",
    "chiang mai": "清迈",
    "清邁": "清迈",
    "kuala lumpur": "吉隆坡",
    "kl": "吉隆坡",
    "bali": "巴厘岛",
    "峇里岛": "巴厘岛",
    "da nang": "岘港",
    "峴港": "岘港",
    "manila": "马尼拉",
    "馬尼拉": "马尼拉",
    # Korea
    "seoul": "首尔",
    "首爾": "首尔",
    # Other
    "taipei": "台北",
    "臺北": "台北",
    "hong kong": "香港",
    "hongkong": "香港",
    "macau": "澳门",
    "macao": "澳门",
    "澳門": "澳门",
}


def _normalize_dest(dest: str) -> str:
    """Normalize destination name to canonical form."""
    d = dest.strip().lower()
    return _DEST_ALIASES.get(d, dest.strip())


# ── Preset route data ────────────────────────────────────
# Each entry: (canonical_dest, total_hours, budget_amount, budget_currency, tags, title, legs_data)

_PRESET_DATA: list[dict] = [
    # ── 1. 冲绳 48H ──
    {
        "destination": "冲绳",
        "total_hours": 48,
        "budget_amount": 2800,
        "currency": "CNY",
        "tags": ["疯狂暴走", "极限吃货"],
        "title": "48H 怒刷冲绳，人均 ¥2800 极限挑战",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-03-15T08:00:00", "end_time_local": "2026-03-15T11:00:00",
                "activity_type": "flight",
                "place": {"name": "那霸机场", "latitude": 26.1958, "longitude": 127.6459},
                "transport": {"mode": "flight", "reference": "春秋航空 9C6218"},
                "estimated_cost": {"amount": 800, "currency": "CNY"},
                "tips": ["提前 2 周订票最便宜", "随身 7kg 行李够了"],
            },
            {
                "index": 1, "start_time_local": "2026-03-15T11:30:00", "end_time_local": "2026-03-15T12:30:00",
                "activity_type": "food",
                "place": {"name": "牧志公设市场", "latitude": 26.2144, "longitude": 127.6868},
                "transport": {"mode": "bus", "reference": "那霸单轨 → 牧志站"},
                "estimated_cost": {"amount": 80, "currency": "CNY"},
                "tips": ["二楼加工海鲜才 500 日元", "龙虾刺身性价比爆炸"],
            },
            {
                "index": 2, "start_time_local": "2026-03-15T13:00:00", "end_time_local": "2026-03-15T15:00:00",
                "activity_type": "attraction",
                "place": {"name": "首里城", "latitude": 26.2172, "longitude": 127.7195},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["门票 400 日元", "日落前去拍照最佳"],
            },
            {
                "index": 3, "start_time_local": "2026-03-15T15:30:00", "end_time_local": "2026-03-15T18:00:00",
                "activity_type": "shopping",
                "place": {"name": "国际通", "latitude": 26.2148, "longitude": 127.6832},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 200, "currency": "CNY"},
                "tips": ["药妆店比大陆便宜 40%", "盐屋冰淇淋必尝"],
            },
            {
                "index": 4, "start_time_local": "2026-03-15T18:30:00", "end_time_local": "2026-03-15T20:00:00",
                "activity_type": "food",
                "place": {"name": "暖暮拉面 国际通店", "latitude": 26.2155, "longitude": 127.6845},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 55, "currency": "CNY"},
                "tips": ["替玉加 150 日元超划算", "豚骨浓汤必点"],
            },
            {
                "index": 5, "start_time_local": "2026-03-16T09:00:00", "end_time_local": "2026-03-16T14:00:00",
                "activity_type": "attraction",
                "place": {"name": "美丽海水族馆", "latitude": 26.6942, "longitude": 127.8775},
                "transport": {"mode": "bus", "reference": "高速巴士 111 路"},
                "estimated_cost": {"amount": 120, "currency": "CNY"},
                "tips": ["提前网购门票省 200 日元", "鲸鲨喂食秀 15:00"],
            },
            {
                "index": 6, "start_time_local": "2026-03-16T15:00:00", "end_time_local": "2026-03-16T17:00:00",
                "activity_type": "attraction",
                "place": {"name": "万座毛", "latitude": 26.5048, "longitude": 127.8512},
                "transport": {"mode": "bus"},
                "estimated_cost": {"amount": 10, "currency": "CNY"},
                "tips": ["象鼻岩日落绝美", "免费停车场"],
            },
        ],
    },
    # ── 2. 胡志明市 48H ──
    {
        "destination": "胡志明市",
        "total_hours": 48,
        "budget_amount": 350,
        "currency": "CNY",
        "tags": ["穷鬼免税店", "极限吃货"],
        "title": "48H 怒刷胡志明市，人均 ¥350 挑战",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-03-20T06:00:00", "end_time_local": "2026-03-20T08:00:00",
                "activity_type": "flight",
                "place": {"name": "新山一国际机场", "latitude": 10.8189, "longitude": 106.6519},
                "transport": {"mode": "flight", "reference": "VietJet VJ886"},
                "estimated_cost": {"amount": 150, "currency": "CNY"},
                "tips": ["越捷航空大促常有 0 元机票", "只带背包省行李费"],
            },
            {
                "index": 1, "start_time_local": "2026-03-20T08:30:00", "end_time_local": "2026-03-20T09:30:00",
                "activity_type": "food",
                "place": {"name": "Phở Hòa Pasteur", "latitude": 10.7769, "longitude": 106.6896},
                "transport": {"mode": "bus", "reference": "109 路公交 → 市中心"},
                "estimated_cost": {"amount": 15, "currency": "CNY"},
                "tips": ["当地人最爱的牛肉粉", "大份才 60k 越南盾"],
            },
            {
                "index": 2, "start_time_local": "2026-03-20T10:00:00", "end_time_local": "2026-03-20T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "统一宫", "latitude": 10.7769, "longitude": 106.6955},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 10, "currency": "CNY"},
                "tips": ["门票 40k 越南盾", "了解越战历史必去"],
            },
            {
                "index": 3, "start_time_local": "2026-03-20T12:30:00", "end_time_local": "2026-03-20T14:00:00",
                "activity_type": "food",
                "place": {"name": "滨城市场", "latitude": 10.7721, "longitude": 106.6990},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 20, "currency": "CNY"},
                "tips": ["法棍 10k 很好吃", "砍价到一半开始"],
            },
            {
                "index": 4, "start_time_local": "2026-03-20T15:00:00", "end_time_local": "2026-03-20T17:00:00",
                "activity_type": "attraction",
                "place": {"name": "西贡圣母大教堂", "latitude": 10.7798, "longitude": 106.6990},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["免费参观", "对面中央邮局也值得看"],
            },
            {
                "index": 5, "start_time_local": "2026-03-20T18:00:00", "end_time_local": "2026-03-20T20:00:00",
                "activity_type": "food",
                "place": {"name": "范五老街", "latitude": 10.7676, "longitude": 106.6932},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 25, "currency": "CNY"},
                "tips": ["越南春卷 + bia hoi 才 10 块", "晚上夜市氛围超棒"],
            },
        ],
    },
    # ── 3. 曼谷 24H ──
    {
        "destination": "曼谷",
        "total_hours": 24,
        "budget_amount": 200,
        "currency": "CNY",
        "tags": ["极限吃货", "打卡狂魔"],
        "title": "曼谷 24H 极限吃货路线，¥200 封顶",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-04-01T07:00:00", "end_time_local": "2026-04-01T08:00:00",
                "activity_type": "food",
                "place": {"name": "胜利纪念碑船面", "latitude": 13.7650, "longitude": 100.5388},
                "transport": {"mode": "metro", "reference": "BTS 胜利纪念碑站"},
                "estimated_cost": {"amount": 8, "currency": "CNY"},
                "tips": ["一碗才 40 泰铢", "当地人排队那家最好"],
            },
            {
                "index": 1, "start_time_local": "2026-04-01T08:30:00", "end_time_local": "2026-04-01T10:30:00",
                "activity_type": "attraction",
                "place": {"name": "大皇宫", "latitude": 13.7500, "longitude": 100.4913},
                "transport": {"mode": "bus", "reference": "公交船 → Tha Chang"},
                "estimated_cost": {"amount": 35, "currency": "CNY"},
                "tips": ["门票 500 泰铢", "穿长裤长裙否则进不去"],
            },
            {
                "index": 2, "start_time_local": "2026-04-01T11:00:00", "end_time_local": "2026-04-01T12:30:00",
                "activity_type": "food",
                "place": {"name": "Jay Fai", "latitude": 13.7554, "longitude": 100.5054},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 60, "currency": "CNY"},
                "tips": ["米其林一星路边摊", "蟹肉蛋卷必点"],
            },
            {
                "index": 3, "start_time_local": "2026-04-01T13:00:00", "end_time_local": "2026-04-01T15:00:00",
                "activity_type": "attraction",
                "place": {"name": "卧佛寺", "latitude": 13.7463, "longitude": 100.4930},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 17, "currency": "CNY"},
                "tips": ["门票 200 泰铢", "泰式按摩发源地"],
            },
            {
                "index": 4, "start_time_local": "2026-04-01T16:00:00", "end_time_local": "2026-04-01T18:00:00",
                "activity_type": "shopping",
                "place": {"name": "恰图恰周末市场", "latitude": 13.7999, "longitude": 100.5512},
                "transport": {"mode": "metro", "reference": "BTS Mo Chit 站"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["上万家小店", "椰子冰淇淋 20 铢"],
            },
            {
                "index": 5, "start_time_local": "2026-04-01T19:00:00", "end_time_local": "2026-04-01T21:00:00",
                "activity_type": "food",
                "place": {"name": "拉差达火车夜市", "latitude": 13.7647, "longitude": 100.5734},
                "transport": {"mode": "metro", "reference": "MRT Thailand Cultural Centre"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["网红彩色帐篷夜市", "烤海鲜拼盘 100 铢起"],
            },
        ],
    },
    # ── 4. 曼谷 48H 暴走版 ──
    {
        "destination": "曼谷",
        "total_hours": 48,
        "budget_amount": 500,
        "currency": "CNY",
        "tags": ["疯狂暴走", "极限吃货"],
        "title": "48H 怒刷曼谷，¥500 穷游极限",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-04-01T07:00:00", "end_time_local": "2026-04-01T08:00:00",
                "activity_type": "food",
                "place": {"name": "胜利纪念碑船面", "latitude": 13.7650, "longitude": 100.5388},
                "transport": {"mode": "metro", "reference": "BTS 胜利纪念碑站"},
                "estimated_cost": {"amount": 8, "currency": "CNY"},
                "tips": ["一碗才 40 铢", "当地人排队那家最好"],
            },
            {
                "index": 1, "start_time_local": "2026-04-01T08:30:00", "end_time_local": "2026-04-01T10:30:00",
                "activity_type": "attraction",
                "place": {"name": "大皇宫 + 玉佛寺", "latitude": 13.7500, "longitude": 100.4913},
                "transport": {"mode": "bus", "reference": "公交船 → Tha Chang"},
                "estimated_cost": {"amount": 35, "currency": "CNY"},
                "tips": ["门票 500 铢含玉佛寺", "穿长裤长裙"],
            },
            {
                "index": 2, "start_time_local": "2026-04-01T11:00:00", "end_time_local": "2026-04-01T12:30:00",
                "activity_type": "food",
                "place": {"name": "Jay Fai", "latitude": 13.7554, "longitude": 100.5054},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 60, "currency": "CNY"},
                "tips": ["米其林一星路边摊", "蟹肉蛋卷必点"],
            },
            {
                "index": 3, "start_time_local": "2026-04-01T13:00:00", "end_time_local": "2026-04-01T16:00:00",
                "activity_type": "attraction",
                "place": {"name": "唐人街耀华力路", "latitude": 13.7394, "longitude": 100.5101},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 20, "currency": "CNY"},
                "tips": ["燕窝 30 铢一碗", "榴莲季直接街边吃"],
            },
            {
                "index": 4, "start_time_local": "2026-04-01T17:00:00", "end_time_local": "2026-04-01T19:00:00",
                "activity_type": "shopping",
                "place": {"name": "暹罗广场", "latitude": 13.7453, "longitude": 100.5345},
                "transport": {"mode": "metro", "reference": "BTS Siam 站"},
                "estimated_cost": {"amount": 50, "currency": "CNY"},
                "tips": ["Siam Square One 潮牌便宜", "美食广场本地价"],
            },
            {
                "index": 5, "start_time_local": "2026-04-01T19:30:00", "end_time_local": "2026-04-01T21:30:00",
                "activity_type": "food",
                "place": {"name": "拉差达火车夜市", "latitude": 13.7647, "longitude": 100.5734},
                "transport": {"mode": "metro", "reference": "MRT Thailand Cultural Centre"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["烤海鲜拼盘 100 铢起", "彩色帐篷必打卡"],
            },
            {
                "index": 6, "start_time_local": "2026-04-02T08:00:00", "end_time_local": "2026-04-02T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "丹嫩沙多水上市场", "latitude": 13.5179, "longitude": 99.9578},
                "transport": {"mode": "bus", "reference": "包车/拼车 ¥25"},
                "estimated_cost": {"amount": 40, "currency": "CNY"},
                "tips": ["早上 7:00 出发避高峰", "提前拼车更便宜"],
            },
            {
                "index": 7, "start_time_local": "2026-04-02T14:00:00", "end_time_local": "2026-04-02T17:00:00",
                "activity_type": "attraction",
                "place": {"name": "卧佛寺 + 郑王庙", "latitude": 13.7463, "longitude": 100.4930},
                "transport": {"mode": "bus", "reference": "渡船过河 4 铢"},
                "estimated_cost": {"amount": 25, "currency": "CNY"},
                "tips": ["郑王庙日落绝美", "白色建筑拍照圣地"],
            },
        ],
    },
    # ── 5. 东京 48H ──
    {
        "destination": "东京",
        "total_hours": 48,
        "budget_amount": 3500,
        "currency": "CNY",
        "tags": ["疯狂暴走", "极限吃货"],
        "title": "48H 怒刷东京，人均 ¥3500 暴走攻略",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-04-05T09:00:00", "end_time_local": "2026-04-05T10:00:00",
                "activity_type": "food",
                "place": {"name": "筑地场外市场", "latitude": 35.6654, "longitude": 139.7707},
                "transport": {"mode": "metro", "reference": "日比谷线 → 筑地站"},
                "estimated_cost": {"amount": 80, "currency": "CNY"},
                "tips": ["玉子烧 + 海鲜丼早餐", "6:00 开门人最少"],
            },
            {
                "index": 1, "start_time_local": "2026-04-05T10:30:00", "end_time_local": "2026-04-05T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "浅草寺 + 仲见世通", "latitude": 35.7148, "longitude": 139.7967},
                "transport": {"mode": "metro", "reference": "银座线 → 浅草站"},
                "estimated_cost": {"amount": 20, "currency": "CNY"},
                "tips": ["免费参观", "雷门大灯笼必拍"],
            },
            {
                "index": 2, "start_time_local": "2026-04-05T12:30:00", "end_time_local": "2026-04-05T14:00:00",
                "activity_type": "food",
                "place": {"name": "一兰拉面 浅草店", "latitude": 35.7108, "longitude": 139.7963},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 55, "currency": "CNY"},
                "tips": ["单人隔间吃面", "替玉加 210 日元"],
            },
            {
                "index": 3, "start_time_local": "2026-04-05T14:30:00", "end_time_local": "2026-04-05T17:00:00",
                "activity_type": "shopping",
                "place": {"name": "秋叶原电器街", "latitude": 35.7023, "longitude": 139.7745},
                "transport": {"mode": "metro", "reference": "JR 秋叶原站"},
                "estimated_cost": {"amount": 300, "currency": "CNY"},
                "tips": ["药妆 + 电器免税", "Yodobashi 价格最好"],
            },
            {
                "index": 4, "start_time_local": "2026-04-05T17:30:00", "end_time_local": "2026-04-05T19:30:00",
                "activity_type": "attraction",
                "place": {"name": "东京塔", "latitude": 35.6586, "longitude": 139.7454},
                "transport": {"mode": "metro", "reference": "赤羽桥站"},
                "estimated_cost": {"amount": 50, "currency": "CNY"},
                "tips": ["展望台 1200 日元", "夜景比晴空塔人少"],
            },
            {
                "index": 5, "start_time_local": "2026-04-06T09:00:00", "end_time_local": "2026-04-06T11:00:00",
                "activity_type": "attraction",
                "place": {"name": "明治神宫", "latitude": 35.6764, "longitude": 139.6993},
                "transport": {"mode": "metro", "reference": "JR 原宿站"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["免费参观", "森林里的神社超治愈"],
            },
            {
                "index": 6, "start_time_local": "2026-04-06T11:30:00", "end_time_local": "2026-04-06T14:00:00",
                "activity_type": "shopping",
                "place": {"name": "涩谷 109 + 忠犬八公", "latitude": 35.6595, "longitude": 139.7004},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 100, "currency": "CNY"},
                "tips": ["十字路口必拍", "Starbucks 2F 最佳机位"],
            },
            {
                "index": 7, "start_time_local": "2026-04-06T15:00:00", "end_time_local": "2026-04-06T17:00:00",
                "activity_type": "attraction",
                "place": {"name": "新宿御苑", "latitude": 35.6852, "longitude": 139.7100},
                "transport": {"mode": "metro", "reference": "新宿御苑前站"},
                "estimated_cost": {"amount": 15, "currency": "CNY"},
                "tips": ["门票 500 日元", "樱花季必去"],
            },
        ],
    },
    # ── 6. 大阪 48H ──
    {
        "destination": "大阪",
        "total_hours": 48,
        "budget_amount": 3000,
        "currency": "CNY",
        "tags": ["极限吃货", "疯狂暴走"],
        "title": "48H 怒刷大阪，¥3000 吃倒在天堂",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-04-10T09:00:00", "end_time_local": "2026-04-10T10:30:00",
                "activity_type": "food",
                "place": {"name": "黑门市场", "latitude": 34.6620, "longitude": 135.5069},
                "transport": {"mode": "metro", "reference": "日本桥站"},
                "estimated_cost": {"amount": 80, "currency": "CNY"},
                "tips": ["大阪人的厨房", "金枪鱼刺身 500 日元"],
            },
            {
                "index": 1, "start_time_local": "2026-04-10T11:00:00", "end_time_local": "2026-04-10T13:00:00",
                "activity_type": "attraction",
                "place": {"name": "大阪城天守阁", "latitude": 34.6873, "longitude": 135.5262},
                "transport": {"mode": "metro", "reference": "森ノ宮站"},
                "estimated_cost": {"amount": 35, "currency": "CNY"},
                "tips": ["门票 600 日元", "樱花季护城河绝美"],
            },
            {
                "index": 2, "start_time_local": "2026-04-10T13:30:00", "end_time_local": "2026-04-10T14:30:00",
                "activity_type": "food",
                "place": {"name": "道顿堀", "latitude": 34.6687, "longitude": 135.5013},
                "transport": {"mode": "metro", "reference": "难波站"},
                "estimated_cost": {"amount": 60, "currency": "CNY"},
                "tips": ["章鱼烧 + 大阪烧 + 串炸", "格力高跑步人打卡"],
            },
            {
                "index": 3, "start_time_local": "2026-04-10T15:00:00", "end_time_local": "2026-04-10T18:00:00",
                "activity_type": "shopping",
                "place": {"name": "心斋桥筋商店街", "latitude": 34.6722, "longitude": 135.5017},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 200, "currency": "CNY"},
                "tips": ["药妆店 Don Quijote 24H", "能退税"],
            },
            {
                "index": 4, "start_time_local": "2026-04-10T19:00:00", "end_time_local": "2026-04-10T21:00:00",
                "activity_type": "food",
                "place": {"name": "新世界通天阁", "latitude": 34.6525, "longitude": 135.5063},
                "transport": {"mode": "metro", "reference": "惠美须町站"},
                "estimated_cost": {"amount": 50, "currency": "CNY"},
                "tips": ["串炸发源地", "达摩串炸必排队"],
            },
            {
                "index": 5, "start_time_local": "2026-04-11T09:00:00", "end_time_local": "2026-04-11T15:00:00",
                "activity_type": "attraction",
                "place": {"name": "环球影城 USJ", "latitude": 34.6654, "longitude": 135.4323},
                "transport": {"mode": "train", "reference": "JR 梦咲线"},
                "estimated_cost": {"amount": 350, "currency": "CNY"},
                "tips": ["提前买快速票省 2h", "哈利波特园区必去"],
            },
        ],
    },
    # ── 7. 新加坡 48H ──
    {
        "destination": "新加坡",
        "total_hours": 48,
        "budget_amount": 1500,
        "currency": "CNY",
        "tags": ["打卡狂魔", "极限吃货"],
        "title": "48H 新加坡极限打卡，¥1500 花园城市",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-04-15T09:00:00", "end_time_local": "2026-04-15T11:00:00",
                "activity_type": "attraction",
                "place": {"name": "滨海湾花园", "latitude": 1.2816, "longitude": 103.8636},
                "transport": {"mode": "metro", "reference": "CE1/DT16 Bayfront"},
                "estimated_cost": {"amount": 60, "currency": "CNY"},
                "tips": ["Cloud Forest + Flower Dome 套票", "空中走廊免费"],
            },
            {
                "index": 1, "start_time_local": "2026-04-15T11:30:00", "end_time_local": "2026-04-15T12:30:00",
                "activity_type": "food",
                "place": {"name": "老巴刹美食广场", "latitude": 1.2807, "longitude": 103.8505},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["沙爹串 0.7 新币/串", "晚上烧烤氛围更好"],
            },
            {
                "index": 2, "start_time_local": "2026-04-15T13:00:00", "end_time_local": "2026-04-15T14:30:00",
                "activity_type": "attraction",
                "place": {"name": "鱼尾狮公园", "latitude": 1.2868, "longitude": 103.8545},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["免费打卡", "对面就是金沙酒店"],
            },
            {
                "index": 3, "start_time_local": "2026-04-15T15:00:00", "end_time_local": "2026-04-15T17:00:00",
                "activity_type": "shopping",
                "place": {"name": "乌节路", "latitude": 1.3048, "longitude": 103.8318},
                "transport": {"mode": "metro", "reference": "NS22 Orchard"},
                "estimated_cost": {"amount": 100, "currency": "CNY"},
                "tips": ["ION Orchard 地下美食多", "Lucky Plaza 菲佣街可换汇"],
            },
            {
                "index": 4, "start_time_local": "2026-04-15T18:00:00", "end_time_local": "2026-04-15T20:00:00",
                "activity_type": "food",
                "place": {"name": "牛车水麦克斯韦熟食中心", "latitude": 1.2803, "longitude": 103.8448},
                "transport": {"mode": "metro", "reference": "NE4 Chinatown"},
                "estimated_cost": {"amount": 25, "currency": "CNY"},
                "tips": ["天天海南鸡饭 3.5 新币", "老伴豆花甜品"],
            },
            {
                "index": 5, "start_time_local": "2026-04-16T09:00:00", "end_time_local": "2026-04-16T13:00:00",
                "activity_type": "attraction",
                "place": {"name": "圣淘沙岛", "latitude": 1.2494, "longitude": 103.8303},
                "transport": {"mode": "metro", "reference": "圣淘沙捷运免费"},
                "estimated_cost": {"amount": 120, "currency": "CNY"},
                "tips": ["Siloso 海滩免费", "S.E.A. 海洋馆值得"],
            },
            {
                "index": 6, "start_time_local": "2026-04-16T14:00:00", "end_time_local": "2026-04-16T16:00:00",
                "activity_type": "attraction",
                "place": {"name": "小印度 + 哈芝巷", "latitude": 1.3066, "longitude": 103.8518},
                "transport": {"mode": "metro", "reference": "NE7 Little India"},
                "estimated_cost": {"amount": 15, "currency": "CNY"},
                "tips": ["彩色墙壁拍照圣地", "印度飞饼 1.5 新币"],
            },
        ],
    },
    # ── 8. 清迈 48H ──
    {
        "destination": "清迈",
        "total_hours": 48,
        "budget_amount": 400,
        "currency": "CNY",
        "tags": ["穷鬼免税店", "打卡狂魔"],
        "title": "48H 清迈慢生活，¥400 佛系穷游",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-04-20T08:00:00", "end_time_local": "2026-04-20T09:30:00",
                "activity_type": "food",
                "place": {"name": "凤飞飞猪脚饭", "latitude": 18.7953, "longitude": 98.9845},
                "transport": {"mode": "taxi", "reference": "双条车 → 北门"},
                "estimated_cost": {"amount": 8, "currency": "CNY"},
                "tips": ["清迈最火小吃", "猪脚饭大份 50 铢"],
            },
            {
                "index": 1, "start_time_local": "2026-04-20T10:00:00", "end_time_local": "2026-04-20T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "素贴山双龙寺", "latitude": 18.8049, "longitude": 98.9218},
                "transport": {"mode": "taxi", "reference": "双条车上山 60 铢/人"},
                "estimated_cost": {"amount": 15, "currency": "CNY"},
                "tips": ["门票 30 铢", "俯瞰整个清迈"],
            },
            {
                "index": 2, "start_time_local": "2026-04-20T12:30:00", "end_time_local": "2026-04-20T14:00:00",
                "activity_type": "food",
                "place": {"name": "宁曼路 Ristr8to 咖啡", "latitude": 18.7968, "longitude": 98.9683},
                "transport": {"mode": "taxi", "reference": "双条车下山"},
                "estimated_cost": {"amount": 15, "currency": "CNY"},
                "tips": ["拉花冠军咖啡", "隔壁 Mango Tango 芒果糯米饭"],
            },
            {
                "index": 3, "start_time_local": "2026-04-20T14:30:00", "end_time_local": "2026-04-20T16:30:00",
                "activity_type": "attraction",
                "place": {"name": "清迈古城寺庙群", "latitude": 18.7883, "longitude": 98.9930},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["帕辛寺 + 契迪龙寺均免费", "下午光线拍照最好"],
            },
            {
                "index": 4, "start_time_local": "2026-04-20T18:00:00", "end_time_local": "2026-04-20T21:00:00",
                "activity_type": "food",
                "place": {"name": "周日夜市 (塔佩门)", "latitude": 18.7869, "longitude": 99.0002},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 25, "currency": "CNY"},
                "tips": ["全东南亚最大夜市之一", "烤肉串 10 铢/串"],
            },
            {
                "index": 5, "start_time_local": "2026-04-21T08:00:00", "end_time_local": "2026-04-21T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "丛林飞跃 Flight of the Gibbon", "latitude": 18.9250, "longitude": 99.0000},
                "transport": {"mode": "bus", "reference": "含酒店接送"},
                "estimated_cost": {"amount": 150, "currency": "CNY"},
                "tips": ["提前 TB 预订更便宜", "含自助午餐"],
            },
        ],
    },
    # ── 9. 吉隆坡 48H ──
    {
        "destination": "吉隆坡",
        "total_hours": 48,
        "budget_amount": 600,
        "currency": "CNY",
        "tags": ["极限吃货", "打卡狂魔"],
        "title": "48H 吉隆坡多元美食，¥600 吃遍三大族",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-04-22T09:00:00", "end_time_local": "2026-04-22T10:30:00",
                "activity_type": "food",
                "place": {"name": "阿罗街夜市", "latitude": 3.1438, "longitude": 101.7095},
                "transport": {"mode": "metro", "reference": "单轨 Bukit Bintang 站"},
                "estimated_cost": {"amount": 20, "currency": "CNY"},
                "tips": ["黄亚华小食店烤鸡翅", "白天也有档口"],
            },
            {
                "index": 1, "start_time_local": "2026-04-22T11:00:00", "end_time_local": "2026-04-22T13:00:00",
                "activity_type": "attraction",
                "place": {"name": "双子塔 KLCC", "latitude": 3.1578, "longitude": 101.7117},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 45, "currency": "CNY"},
                "tips": ["天桥门票 RM80", "KLCC 公园免费散步"],
            },
            {
                "index": 2, "start_time_local": "2026-04-22T13:30:00", "end_time_local": "2026-04-22T14:30:00",
                "activity_type": "food",
                "place": {"name": "Village Park Restaurant 椰浆饭", "latitude": 3.1535, "longitude": 101.6647},
                "transport": {"mode": "taxi", "reference": "Grab RM8"},
                "estimated_cost": {"amount": 12, "currency": "CNY"},
                "tips": ["全 KL 最好吃椰浆饭", "炸鸡配饭绝了"],
            },
            {
                "index": 3, "start_time_local": "2026-04-22T15:00:00", "end_time_local": "2026-04-22T17:00:00",
                "activity_type": "attraction",
                "place": {"name": "黑风洞", "latitude": 3.2377, "longitude": 101.6841},
                "transport": {"mode": "train", "reference": "KTM 到 Batu Caves 站"},
                "estimated_cost": {"amount": 5, "currency": "CNY"},
                "tips": ["272 级彩虹阶梯", "免费参观"],
            },
            {
                "index": 4, "start_time_local": "2026-04-22T18:00:00", "end_time_local": "2026-04-22T20:00:00",
                "activity_type": "food",
                "place": {"name": "茨厂街 (唐人街)", "latitude": 3.1435, "longitude": 101.6973},
                "transport": {"mode": "metro", "reference": "LRT Pasar Seni 站"},
                "estimated_cost": {"amount": 15, "currency": "CNY"},
                "tips": ["罗汉果凉茶 RM2", "猪肠粉 RM3"],
            },
            {
                "index": 5, "start_time_local": "2026-04-23T09:00:00", "end_time_local": "2026-04-23T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "国家清真寺 + 独立广场", "latitude": 3.1415, "longitude": 101.6919},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["免费参观（需穿长袖长裤）", "独立广场拍照好看"],
            },
        ],
    },
    # ── 10. 首尔 48H ──
    {
        "destination": "首尔",
        "total_hours": 48,
        "budget_amount": 2000,
        "currency": "CNY",
        "tags": ["疯狂暴走", "打卡狂魔"],
        "title": "48H 首尔暴走，¥2000 韩流朝圣",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-05-01T09:00:00", "end_time_local": "2026-05-01T11:00:00",
                "activity_type": "attraction",
                "place": {"name": "景福宫", "latitude": 37.5796, "longitude": 126.9770},
                "transport": {"mode": "metro", "reference": "3号线 景福宫站"},
                "estimated_cost": {"amount": 15, "currency": "CNY"},
                "tips": ["穿韩服免门票", "光化门换岗仪式 10:00"],
            },
            {
                "index": 1, "start_time_local": "2026-05-01T11:30:00", "end_time_local": "2026-05-01T13:00:00",
                "activity_type": "food",
                "place": {"name": "北村韩屋 + 三清洞", "latitude": 37.5826, "longitude": 126.9838},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["网红墙打卡", "人参鸡汤 ¥50"],
            },
            {
                "index": 2, "start_time_local": "2026-05-01T14:00:00", "end_time_local": "2026-05-01T16:00:00",
                "activity_type": "shopping",
                "place": {"name": "明洞", "latitude": 37.5636, "longitude": 126.9860},
                "transport": {"mode": "metro", "reference": "4号线 明洞站"},
                "estimated_cost": {"amount": 200, "currency": "CNY"},
                "tips": ["化妆品免税天堂", "Olive Young 必逛"],
            },
            {
                "index": 3, "start_time_local": "2026-05-01T16:30:00", "end_time_local": "2026-05-01T18:00:00",
                "activity_type": "attraction",
                "place": {"name": "N首尔塔", "latitude": 37.5512, "longitude": 126.9882},
                "transport": {"mode": "bus", "reference": "南山循环巴士"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["同心锁墙", "夜景绝美"],
            },
            {
                "index": 4, "start_time_local": "2026-05-01T19:00:00", "end_time_local": "2026-05-01T21:00:00",
                "activity_type": "food",
                "place": {"name": "弘大街头 + 烤肉", "latitude": 37.5563, "longitude": 126.9237},
                "transport": {"mode": "metro", "reference": "2号线 弘大入口站"},
                "estimated_cost": {"amount": 80, "currency": "CNY"},
                "tips": ["姜虎东烤肉性价比高", "弘大夜晚街头表演"],
            },
            {
                "index": 5, "start_time_local": "2026-05-02T09:00:00", "end_time_local": "2026-05-02T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "梨泰院 + 经理团路", "latitude": 37.5345, "longitude": 126.9946},
                "transport": {"mode": "metro", "reference": "6号线 梨泰院站"},
                "estimated_cost": {"amount": 40, "currency": "CNY"},
                "tips": ["复古咖啡馆聚集地", "文创小店很多"],
            },
            {
                "index": 6, "start_time_local": "2026-05-02T13:00:00", "end_time_local": "2026-05-02T15:00:00",
                "activity_type": "food",
                "place": {"name": "广藏市场", "latitude": 37.5700, "longitude": 127.0100},
                "transport": {"mode": "metro", "reference": "1号线 钟路5街站"},
                "estimated_cost": {"amount": 40, "currency": "CNY"},
                "tips": ["绿豆煎饼 + 麻药紫菜饭卷", "现做年糕"],
            },
        ],
    },
    # ── 11. 巴厘岛 72H ──
    {
        "destination": "巴厘岛",
        "total_hours": 72,
        "budget_amount": 1200,
        "currency": "CNY",
        "tags": ["打卡狂魔", "疯狂暴走"],
        "title": "72H 巴厘岛海岛穷游，¥1200 神仙体验",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-05-10T10:00:00", "end_time_local": "2026-05-10T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "海神庙", "latitude": -8.6212, "longitude": 115.0868},
                "transport": {"mode": "taxi", "reference": "Grab Bike 20k IDR"},
                "estimated_cost": {"amount": 20, "currency": "CNY"},
                "tips": ["日落时分最美", "门票 60k IDR"],
            },
            {
                "index": 1, "start_time_local": "2026-05-10T13:00:00", "end_time_local": "2026-05-10T14:00:00",
                "activity_type": "food",
                "place": {"name": "脏鸭餐 Bebek Bengil", "latitude": -8.5230, "longitude": 115.2605},
                "transport": {"mode": "taxi", "reference": "Grab 50k IDR"},
                "estimated_cost": {"amount": 35, "currency": "CNY"},
                "tips": ["招牌脏鸭套餐", "田园景观座位"],
            },
            {
                "index": 2, "start_time_local": "2026-05-10T14:30:00", "end_time_local": "2026-05-10T17:00:00",
                "activity_type": "attraction",
                "place": {"name": "德格拉朗梯田", "latitude": -8.4312, "longitude": 115.2793},
                "transport": {"mode": "taxi"},
                "estimated_cost": {"amount": 10, "currency": "CNY"},
                "tips": ["门票 15k IDR", "网红秋千 100k IDR"],
            },
            {
                "index": 3, "start_time_local": "2026-05-10T18:00:00", "end_time_local": "2026-05-10T20:00:00",
                "activity_type": "food",
                "place": {"name": "乌布皇宫 + 夜晚舞蹈", "latitude": -8.5069, "longitude": 115.2625},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 25, "currency": "CNY"},
                "tips": ["晚上的巴龙舞表演", "夜市小吃 10k 起"],
            },
            {
                "index": 4, "start_time_local": "2026-05-11T08:00:00", "end_time_local": "2026-05-11T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "蓝梦岛浮潜", "latitude": -8.6816, "longitude": 115.4450},
                "transport": {"mode": "bus", "reference": "快艇 35 分钟"},
                "estimated_cost": {"amount": 120, "currency": "CNY"},
                "tips": ["TB 提前订含接送", "魔鬼眼泪打卡"],
            },
            {
                "index": 5, "start_time_local": "2026-05-11T14:00:00", "end_time_local": "2026-05-11T17:00:00",
                "activity_type": "attraction",
                "place": {"name": "库塔海滩冲浪", "latitude": -8.7184, "longitude": 115.1686},
                "transport": {"mode": "taxi"},
                "estimated_cost": {"amount": 40, "currency": "CNY"},
                "tips": ["冲浪课 100k IDR/小时", "日落最美海滩"],
            },
            {
                "index": 6, "start_time_local": "2026-05-12T06:00:00", "end_time_local": "2026-05-12T10:00:00",
                "activity_type": "attraction",
                "place": {"name": "巴图尔火山日出", "latitude": -8.2417, "longitude": 115.3750},
                "transport": {"mode": "taxi", "reference": "含导游 + 早餐"},
                "estimated_cost": {"amount": 80, "currency": "CNY"},
                "tips": ["凌晨 2:00 出发", "TB 拼团更便宜"],
            },
        ],
    },
    # ── 12. 岘港 48H ──
    {
        "destination": "岘港",
        "total_hours": 48,
        "budget_amount": 400,
        "currency": "CNY",
        "tags": ["穷鬼免税店", "打卡狂魔"],
        "title": "48H 岘港超值海滩游，¥400 穷游天堂",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-05-15T09:00:00", "end_time_local": "2026-05-15T11:00:00",
                "activity_type": "attraction",
                "place": {"name": "巴拿山 + 佛手金桥", "latitude": 15.9975, "longitude": 107.9940},
                "transport": {"mode": "taxi", "reference": "Grab 150k VND"},
                "estimated_cost": {"amount": 100, "currency": "CNY"},
                "tips": ["缆车 + 门票含游乐设施", "金桥必拍"],
            },
            {
                "index": 1, "start_time_local": "2026-05-15T12:00:00", "end_time_local": "2026-05-15T13:00:00",
                "activity_type": "food",
                "place": {"name": "Bánh mì Bà Lan 法棍", "latitude": 16.0678, "longitude": 108.2208},
                "transport": {"mode": "taxi"},
                "estimated_cost": {"amount": 5, "currency": "CNY"},
                "tips": ["法棍 15k VND 一个", "加蛋加肉更香"],
            },
            {
                "index": 2, "start_time_local": "2026-05-15T14:00:00", "end_time_local": "2026-05-15T17:00:00",
                "activity_type": "attraction",
                "place": {"name": "美溪海滩", "latitude": 16.0544, "longitude": 108.2462},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["福布斯六大最美海滩", "免费沙滩"],
            },
            {
                "index": 3, "start_time_local": "2026-05-15T18:00:00", "end_time_local": "2026-05-15T20:00:00",
                "activity_type": "food",
                "place": {"name": "韩市场 + 夜市", "latitude": 16.0680, "longitude": 108.2240},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 20, "currency": "CNY"},
                "tips": ["海鲜大排档超便宜", "龙虾才 100k VND"],
            },
            {
                "index": 4, "start_time_local": "2026-05-16T07:00:00", "end_time_local": "2026-05-16T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "会安古城", "latitude": 15.8801, "longitude": 108.3380},
                "transport": {"mode": "bus", "reference": "1 路公交 30k VND"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["放灯笼超浪漫", "古城通票 120k VND"],
            },
            {
                "index": 5, "start_time_local": "2026-05-16T13:00:00", "end_time_local": "2026-05-16T15:00:00",
                "activity_type": "food",
                "place": {"name": "会安高楼面 Cao Lầu", "latitude": 15.8795, "longitude": 108.3380},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 8, "currency": "CNY"},
                "tips": ["会安特有美食", "只有这里才正宗"],
            },
        ],
    },
    # ── 13. 香港 24H ──
    {
        "destination": "香港",
        "total_hours": 24,
        "budget_amount": 500,
        "currency": "CNY",
        "tags": ["极限吃货", "打卡狂魔"],
        "title": "香港 24H 极限美食打卡，¥500 一日暴走",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-05-20T08:00:00", "end_time_local": "2026-05-20T09:00:00",
                "activity_type": "food",
                "place": {"name": "添好运点心", "latitude": 22.3220, "longitude": 114.1694},
                "transport": {"mode": "metro", "reference": "港铁 深水埗站"},
                "estimated_cost": {"amount": 35, "currency": "CNY"},
                "tips": ["米其林最便宜", "酥皮焗叉烧包必点"],
            },
            {
                "index": 1, "start_time_local": "2026-05-20T09:30:00", "end_time_local": "2026-05-20T11:30:00",
                "activity_type": "attraction",
                "place": {"name": "太平山顶", "latitude": 22.2759, "longitude": 114.1455},
                "transport": {"mode": "bus", "reference": "15 路巴士 → 山顶"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["缆车排队长 建议坐巴士", "凌霄阁观景台"],
            },
            {
                "index": 2, "start_time_local": "2026-05-20T12:00:00", "end_time_local": "2026-05-20T13:00:00",
                "activity_type": "food",
                "place": {"name": "兰芳园丝袜奶茶", "latitude": 22.2812, "longitude": 114.1557},
                "transport": {"mode": "metro", "reference": "中环站"},
                "estimated_cost": {"amount": 20, "currency": "CNY"},
                "tips": ["丝袜奶茶发源地", "西多士也好吃"],
            },
            {
                "index": 3, "start_time_local": "2026-05-20T14:00:00", "end_time_local": "2026-05-20T16:00:00",
                "activity_type": "shopping",
                "place": {"name": "旺角 + 女人街", "latitude": 22.3190, "longitude": 114.1694},
                "transport": {"mode": "metro", "reference": "旺角站"},
                "estimated_cost": {"amount": 100, "currency": "CNY"},
                "tips": ["波鞋街找限量款", "信和中心二手游戏"],
            },
            {
                "index": 4, "start_time_local": "2026-05-20T17:00:00", "end_time_local": "2026-05-20T18:30:00",
                "activity_type": "attraction",
                "place": {"name": "尖沙咀星光大道", "latitude": 22.2932, "longitude": 114.1748},
                "transport": {"mode": "metro", "reference": "尖沙咀站"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["维港夜景免费", "幻彩咏香江 20:00"],
            },
            {
                "index": 5, "start_time_local": "2026-05-20T19:00:00", "end_time_local": "2026-05-20T21:00:00",
                "activity_type": "food",
                "place": {"name": "庙街夜市", "latitude": 22.3103, "longitude": 114.1706},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 50, "currency": "CNY"},
                "tips": ["煲仔饭 + 云吞面", "砍价必备"],
            },
        ],
    },
    # ── 14. 台北 48H ──
    {
        "destination": "台北",
        "total_hours": 48,
        "budget_amount": 1500,
        "currency": "CNY",
        "tags": ["极限吃货", "疯狂暴走"],
        "title": "48H 台北吃货暴走，¥1500 夜市天堂",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-05-25T08:00:00", "end_time_local": "2026-05-25T09:30:00",
                "activity_type": "food",
                "place": {"name": "永和豆浆大王", "latitude": 25.0330, "longitude": 121.5654},
                "transport": {"mode": "metro", "reference": "捷运 东门站"},
                "estimated_cost": {"amount": 10, "currency": "CNY"},
                "tips": ["烧饼油条 + 咸豆浆", "24 小时营业"],
            },
            {
                "index": 1, "start_time_local": "2026-05-25T10:00:00", "end_time_local": "2026-05-25T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "故宫博物院", "latitude": 25.1024, "longitude": 121.5485},
                "transport": {"mode": "bus", "reference": "红 30 路"},
                "estimated_cost": {"amount": 25, "currency": "CNY"},
                "tips": ["翠玉白菜 + 肉形石", "周日下午免费"],
            },
            {
                "index": 2, "start_time_local": "2026-05-25T12:30:00", "end_time_local": "2026-05-25T14:00:00",
                "activity_type": "food",
                "place": {"name": "鼎泰丰 信义店", "latitude": 25.0339, "longitude": 121.5644},
                "transport": {"mode": "metro", "reference": "东门站"},
                "estimated_cost": {"amount": 45, "currency": "CNY"},
                "tips": ["小笼包 10 颗 220 台币", "排队约 30 分钟"],
            },
            {
                "index": 3, "start_time_local": "2026-05-25T15:00:00", "end_time_local": "2026-05-25T17:00:00",
                "activity_type": "attraction",
                "place": {"name": "象山步道", "latitude": 25.0276, "longitude": 121.5713},
                "transport": {"mode": "metro", "reference": "象山站"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["拍 101 最佳机位", "爬 20 分钟到顶"],
            },
            {
                "index": 4, "start_time_local": "2026-05-25T18:00:00", "end_time_local": "2026-05-25T21:00:00",
                "activity_type": "food",
                "place": {"name": "饶河夜市", "latitude": 25.0509, "longitude": 121.5776},
                "transport": {"mode": "metro", "reference": "松山站"},
                "estimated_cost": {"amount": 40, "currency": "CNY"},
                "tips": ["胡椒饼排第一", "药炖排骨暖胃"],
            },
            {
                "index": 5, "start_time_local": "2026-05-26T09:00:00", "end_time_local": "2026-05-26T13:00:00",
                "activity_type": "attraction",
                "place": {"name": "九份老街", "latitude": 25.1094, "longitude": 121.8441},
                "transport": {"mode": "bus", "reference": "1062 路直达"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["千与千寻取景地", "芋圆 + 鱼丸汤必吃"],
            },
            {
                "index": 6, "start_time_local": "2026-05-26T14:00:00", "end_time_local": "2026-05-26T16:00:00",
                "activity_type": "shopping",
                "place": {"name": "西门町", "latitude": 25.0421, "longitude": 121.5081},
                "transport": {"mode": "metro", "reference": "西门站"},
                "estimated_cost": {"amount": 100, "currency": "CNY"},
                "tips": ["潮牌 + 美妆", "阿宗面线必排"],
            },
        ],
    },
    # ── 15. 澳门 24H ──
    {
        "destination": "澳门",
        "total_hours": 24,
        "budget_amount": 300,
        "currency": "CNY",
        "tags": ["极限吃货", "打卡狂魔"],
        "title": "澳门 24H 极限暴走，¥300 葡式穷游",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-06-01T09:00:00", "end_time_local": "2026-06-01T10:00:00",
                "activity_type": "food",
                "place": {"name": "玛嘉烈蛋挞", "latitude": 22.1917, "longitude": 113.5397},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 8, "currency": "CNY"},
                "tips": ["葡式蛋挞鼻祖", "一个 10 MOP"],
            },
            {
                "index": 1, "start_time_local": "2026-06-01T10:30:00", "end_time_local": "2026-06-01T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "大三巴 + 恋爱巷", "latitude": 22.1979, "longitude": 113.5409},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["免费打卡地标", "恋爱巷粉色墙拍照"],
            },
            {
                "index": 2, "start_time_local": "2026-06-01T12:30:00", "end_time_local": "2026-06-01T13:30:00",
                "activity_type": "food",
                "place": {"name": "陈光记烧味", "latitude": 22.1936, "longitude": 113.5399},
                "transport": {"mode": "walk"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["黑椒烧鹅饭一绝", "米其林推荐"],
            },
            {
                "index": 3, "start_time_local": "2026-06-01T14:00:00", "end_time_local": "2026-06-01T16:00:00",
                "activity_type": "attraction",
                "place": {"name": "威尼斯人度假村", "latitude": 22.1490, "longitude": 113.5590},
                "transport": {"mode": "bus", "reference": "免费接驳车"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["室内运河贡多拉", "免费参观大厅"],
            },
            {
                "index": 4, "start_time_local": "2026-06-01T17:00:00", "end_time_local": "2026-06-01T18:30:00",
                "activity_type": "attraction",
                "place": {"name": "澳门旅游塔", "latitude": 22.1801, "longitude": 113.5319},
                "transport": {"mode": "bus"},
                "estimated_cost": {"amount": 50, "currency": "CNY"},
                "tips": ["观光层 165 MOP", "蹦极胆大可以试"],
            },
            {
                "index": 5, "start_time_local": "2026-06-01T19:00:00", "end_time_local": "2026-06-01T21:00:00",
                "activity_type": "food",
                "place": {"name": "官也街", "latitude": 22.1535, "longitude": 113.5576},
                "transport": {"mode": "bus"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["猪扒包 + 木糠布丁", "安德鲁蛋挞也在附近"],
            },
        ],
    },
    # ── 16. 京都 48H ──
    {
        "destination": "京都",
        "total_hours": 48,
        "budget_amount": 2500,
        "currency": "CNY",
        "tags": ["打卡狂魔", "疯狂暴走"],
        "title": "48H 京都古寺巡礼，¥2500 千年古都暴走",
        "legs": [
            {
                "index": 0, "start_time_local": "2026-06-05T08:00:00", "end_time_local": "2026-06-05T10:00:00",
                "activity_type": "attraction",
                "place": {"name": "伏见稻荷大社", "latitude": 34.9671, "longitude": 135.7727},
                "transport": {"mode": "train", "reference": "JR 奈良线 → 稻荷站"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["千本鸟居免费", "早上 7 点前人最少"],
            },
            {
                "index": 1, "start_time_local": "2026-06-05T10:30:00", "end_time_local": "2026-06-05T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "清水寺", "latitude": 34.9949, "longitude": 135.7850},
                "transport": {"mode": "bus", "reference": "100 或 206 路"},
                "estimated_cost": {"amount": 20, "currency": "CNY"},
                "tips": ["门票 400 日元", "清水舞台俯瞰京都"],
            },
            {
                "index": 2, "start_time_local": "2026-06-05T12:30:00", "end_time_local": "2026-06-05T13:30:00",
                "activity_type": "food",
                "place": {"name": "锦市场", "latitude": 35.0049, "longitude": 135.7649},
                "transport": {"mode": "bus"},
                "estimated_cost": {"amount": 50, "currency": "CNY"},
                "tips": ["京都的厨房", "抹茶甜品 + 渍物"],
            },
            {
                "index": 3, "start_time_local": "2026-06-05T14:00:00", "end_time_local": "2026-06-05T16:00:00",
                "activity_type": "attraction",
                "place": {"name": "金阁寺", "latitude": 35.0394, "longitude": 135.7292},
                "transport": {"mode": "bus", "reference": "12 路或 59 路"},
                "estimated_cost": {"amount": 20, "currency": "CNY"},
                "tips": ["门票 400 日元", "金色倒影要晴天"],
            },
            {
                "index": 4, "start_time_local": "2026-06-05T17:00:00", "end_time_local": "2026-06-05T19:00:00",
                "activity_type": "attraction",
                "place": {"name": "岚山竹林 + 渡月桥", "latitude": 35.0094, "longitude": 135.6718},
                "transport": {"mode": "train", "reference": "JR 嵯峨野线"},
                "estimated_cost": {"amount": 0, "currency": "CNY"},
                "tips": ["竹林小径免费", "日落渡月桥超美"],
            },
            {
                "index": 5, "start_time_local": "2026-06-05T19:30:00", "end_time_local": "2026-06-05T21:00:00",
                "activity_type": "food",
                "place": {"name": "先斗町小巷", "latitude": 35.0043, "longitude": 135.7702},
                "transport": {"mode": "train"},
                "estimated_cost": {"amount": 60, "currency": "CNY"},
                "tips": ["京料理居酒屋", "河边座位氛围好"],
            },
            {
                "index": 6, "start_time_local": "2026-06-06T09:00:00", "end_time_local": "2026-06-06T12:00:00",
                "activity_type": "attraction",
                "place": {"name": "二条城", "latitude": 35.0142, "longitude": 135.7480},
                "transport": {"mode": "metro", "reference": "东西线 二条城前站"},
                "estimated_cost": {"amount": 30, "currency": "CNY"},
                "tips": ["门票 800 日元", "夜莺地板会叫"],
            },
        ],
    },
]


# ── Build index for fast lookup ──────────────────────────

# Destination → list of presets (one destination can have multiple hour variants)
_DEST_INDEX: dict[str, list[dict]] = {}
for _p in _PRESET_DATA:
    _key = _p["destination"]
    _DEST_INDEX.setdefault(_key, []).append(_p)


def _match_score(
    preset: dict,
    total_hours: int,
    budget_amount: float,
    tags: list[str],
) -> float:
    """Score a preset against user query. Higher = better match.

    Returns 0.0 if hard filters fail (hours mismatch too large).
    """
    score = 10.0  # base score for destination match

    # Hours tolerance: ±50%
    p_hours = preset["total_hours"]
    hour_ratio = abs(total_hours - p_hours) / max(p_hours, 1)
    if hour_ratio > 0.5:
        return 0.0  # too far off
    score += (1.0 - hour_ratio) * 5.0  # up to +5

    # Budget tolerance: ±50%
    p_budget = preset["budget_amount"]
    if budget_amount > 0:
        budget_ratio = abs(budget_amount - p_budget) / max(p_budget, 1)
        if budget_ratio <= 0.5:
            score += (1.0 - budget_ratio) * 3.0  # up to +3

    # Tag overlap bonus
    preset_tags = set(preset.get("tags", []))
    user_tags = set(tags)
    if preset_tags and user_tags:
        overlap = len(preset_tags & user_tags) / max(len(preset_tags | user_tags), 1)
        score += overlap * 2.0  # up to +2

    return score


def find_preset(
    destination: str,
    total_hours: int,
    budget_amount: float,
    budget_currency: str = "CNY",
    tags: list[str] | None = None,
) -> Optional[ItineraryGenerateResponse]:
    """Try to find a matching preset route.

    Returns a fully-formed ItineraryGenerateResponse if found, else None.
    This is O(1) destination lookup + O(n) scoring where n ≤ 5 variants.
    """
    normalized = _normalize_dest(destination)
    candidates = _DEST_INDEX.get(normalized, [])

    if not candidates:
        logger.debug("No preset found for destination=%s (normalized=%s)", destination, normalized)
        return None

    tags = tags or []
    best_preset = None
    best_score = 0.0

    for preset in candidates:
        s = _match_score(preset, total_hours, budget_amount, tags)
        if s > best_score:
            best_score = s
            best_preset = preset

    if best_preset is None or best_score < 5.0:
        logger.debug("Preset candidates for %s but score too low (%.1f)", normalized, best_score)
        return None

    logger.info(
        "Preset match: dest=%s hours=%d budget=%.0f score=%.1f",
        normalized, total_hours, budget_amount, best_score,
    )

    return _build_preset_response(best_preset)


def _build_preset_response(preset: dict) -> ItineraryGenerateResponse:
    """Convert raw preset data to a validated ItineraryGenerateResponse."""
    legs = [ItineraryLeg(**leg) for leg in preset["legs"]]
    places = [leg.place for leg in legs if leg.place]
    maps_url = build_google_maps_url(places)

    total_cost = sum(leg.estimated_cost.amount for leg in legs)

    return ItineraryGenerateResponse(
        itinerary_id=f"preset-{preset['destination'].lower()}-{preset['total_hours']}h",
        title=preset["title"],
        summary=ItinerarySummary(
            total_hours=preset["total_hours"],
            estimated_total_cost=Money(
                amount=total_cost,
                currency=preset.get("currency", "CNY"),
            ),
        ),
        legs=legs,
        map=MapInfo(
            google_maps_deeplink=maps_url,
            waypoints_count=len(places),
        ),
        source=SourceInfo(
            llm_provider="preset",
            model_name="built-in",
            cache_hit=False,
            is_preset=True,
        ),
    )


def get_all_preset_destinations() -> list[str]:
    """Return list of all available preset destinations (for frontend display)."""
    return sorted(_DEST_INDEX.keys())


def get_preset_count() -> int:
    """Return total number of preset routes."""
    return len(_PRESET_DATA)
