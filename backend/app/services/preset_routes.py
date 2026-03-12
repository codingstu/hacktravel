"""Preset routes library — instant response for popular destinations with regional filters.

Architecture: user clicks "开始规划" → preset lookup (0ms) → cache (1ms) → LLM (10-60s)

This version adds:
  1. Continent / sub-region metadata for global coverage
  2. Region-aware preset filtering with graceful global fallback
  3. Region metadata helpers for frontend switches
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Optional

from app.models.itinerary import (
    Continent,
    ItineraryGenerateResponse,
    ItineraryLeg,
    ItinerarySummary,
    MapInfo,
    Money,
    SourceInfo,
)
from app.utils.google_maps import build_google_maps_url

logger = logging.getLogger(__name__)


_REGION_LABELS: dict[str, str] = {
    Continent.ASIA.value: "亚洲",
    Continent.EUROPE.value: "欧洲",
    Continent.AFRICA.value: "非洲",
    Continent.NORTH_AMERICA.value: "北美",
    Continent.SOUTH_AMERICA.value: "南美",
    Continent.OCEANIA.value: "大洋洲",
}

_SUB_REGION_LABELS: dict[str, str] = {
    "EastAsia": "东亚",
    "SoutheastAsia": "东南亚",
    "SouthAsia": "南亚",
    "MiddleEast": "中东",
    "ContinentalEurope": "欧洲大陆",
    "UK": "英国",
    "NorthAfrica": "北非",
    "SubSaharanAfrica": "撒哈拉以南非洲",
    "NorthAmericaCore": "北美核心",
    "LatinAmerica": "拉丁美洲",
    "OceaniaCore": "大洋洲",
}

_DEST_ALIASES: dict[str, str] = {
    # East Asia
    "okinawa": "冲绳",
    "naha": "冲绳",
    "tokyo": "东京",
    "osaka": "大阪",
    "kyoto": "京都",
    "fukuoka": "福冈",
    "sapporo": "札幌",
    "seoul": "首尔",
    "busan": "釜山",
    "taipei": "台北",
    "hong kong": "香港",
    "hongkong": "香港",
    "macau": "澳门",
    "macao": "澳门",
    "shanghai": "上海",
    "beijing": "北京",
    # Southeast Asia
    "bangkok": "曼谷",
    "chiang mai": "清迈",
    "phuket": "普吉岛",
    "kuala lumpur": "吉隆坡",
    "kl": "吉隆坡",
    "penang": "槟城",
    "singapore": "新加坡",
    "bali": "巴厘岛",
    "jakarta": "雅加达",
    "manila": "马尼拉",
    "cebu": "宿务",
    "da nang": "岘港",
    "danang": "岘港",
    "ho chi minh": "胡志明市",
    "hcmc": "胡志明市",
    "saigon": "胡志明市",
    "hanoi": "河内",
    # Europe + UK
    "london": "伦敦",
    "edinburgh": "爱丁堡",
    "manchester": "曼彻斯特",
    "liverpool": "利物浦",
    "paris": "巴黎",
    "rome": "罗马",
    "barcelona": "巴塞罗那",
    "amsterdam": "阿姆斯特丹",
    "lisbon": "里斯本",
    "berlin": "柏林",
    # South America
    "rio": "里约热内卢",
    "rio de janeiro": "里约热内卢",
    "sao paulo": "圣保罗",
    "buenos aires": "布宜诺斯艾利斯",
    "lima": "利马",
    "santiago": "圣地亚哥",
    "bogota": "波哥大",
    "cartagena": "卡塔赫纳",
    # Africa
    "cairo": "开罗",
    "marrakech": "马拉喀什",
    "cape town": "开普敦",
    "johannesburg": "约翰内斯堡",
    "nairobi": "内罗毕",
    "zanzibar": "桑给巴尔",
    # North America
    "new york": "纽约",
    "nyc": "纽约",
    "los angeles": "洛杉矶",
    "vancouver": "温哥华",
    "mexico city": "墨西哥城",
    # Oceania
    "sydney": "悉尼",
    "melbourne": "墨尔本",
    "auckland": "奥克兰",
    "queenstown": "皇后镇",
}


def _normalize_dest(dest: str) -> str:
    d = dest.strip().lower()
    return _DEST_ALIASES.get(d, dest.strip())


def _leg(
    index: int,
    start: str,
    end: str,
    activity_type: str,
    name: str,
    latitude: float,
    longitude: float,
    mode: str,
    cost: float,
    tips: list[str],
    reference: str | None = None,
) -> dict:
    leg = {
        "index": index,
        "start_time_local": start,
        "end_time_local": end,
        "activity_type": activity_type,
        "place": {"name": name, "latitude": latitude, "longitude": longitude},
        "transport": {"mode": mode},
        "estimated_cost": {"amount": cost, "currency": "CNY"},
        "tips": tips,
    }
    if reference:
        leg["transport"]["reference"] = reference
    return leg


def _preset(
    destination: str,
    continent: str,
    sub_region: str,
    total_hours: int,
    budget_amount: int,
    tags: list[str],
    title: str,
    legs: list[dict],
    aliases: list[str] | None = None,
) -> dict:
    return {
        "destination": destination,
        "continent": continent,
        "sub_region": sub_region,
        "total_hours": total_hours,
        "budget_amount": budget_amount,
        "currency": "CNY",
        "tags": tags,
        "title": title,
        "legs": legs,
        "aliases": aliases or [],
    }


_PRESET_DATA: list[dict] = [
    # ── East Asia ──
    _preset(
        "冲绳", Continent.ASIA.value, "EastAsia", 48, 2800, ["疯狂暴走", "极限吃货"],
        "48H 怒刷冲绳，人均 ¥2800 极限挑战",
        [
            _leg(0, "2026-03-15T08:00:00", "2026-03-15T11:00:00", "flight", "那霸机场", 26.1958, 127.6459, "flight", 800, ["提前 2 周订票最便宜"], "春秋航空 9C6218"),
            _leg(1, "2026-03-15T11:30:00", "2026-03-15T12:30:00", "food", "牧志公设市场", 26.2144, 127.6868, "bus", 80, ["二楼加工海鲜性价比高"], "那霸单轨 → 牧志站"),
            _leg(2, "2026-03-15T13:00:00", "2026-03-15T15:00:00", "attraction", "首里城", 26.2172, 127.7195, "walk", 30, ["日落前拍照最佳"]),
            _leg(3, "2026-03-15T15:30:00", "2026-03-15T18:00:00", "shopping", "国际通", 26.2148, 127.6832, "walk", 200, ["药妆和伴手礼密集"]),
            _leg(4, "2026-03-16T09:00:00", "2026-03-16T14:00:00", "attraction", "美丽海水族馆", 26.6942, 127.8775, "bus", 120, ["鲸鲨馆是核心亮点"], "高速巴士 111 路"),
            _leg(5, "2026-03-16T15:00:00", "2026-03-16T17:00:00", "attraction", "万座毛", 26.5048, 127.8512, "bus", 10, ["象鼻岩海岸线很适合收尾"]),
        ],
    ),
    _preset(
        "冲绳", Continent.ASIA.value, "EastAsia", 24, 1800, ["海岛躺平", "极限吃货"],
        "冲绳 24H 海风快闪，¥1800 暴走版",
        [
            _leg(0, "2026-03-15T09:00:00", "2026-03-15T10:30:00", "food", "泊港渔市场", 26.2253, 127.6739, "taxi", 60, ["早上海鲜饭最新鲜"]),
            _leg(1, "2026-03-15T11:00:00", "2026-03-15T13:00:00", "attraction", "首里城", 26.2172, 127.7195, "bus", 30, ["适合快速打卡历史线"], "单轨+步行"),
            _leg(2, "2026-03-15T14:00:00", "2026-03-15T18:00:00", "attraction", "美国村", 26.3177, 127.7568, "bus", 120, ["黄昏海边很出片"], "高速巴士"),
        ],
    ),
    _preset(
        "东京", Continent.ASIA.value, "EastAsia", 48, 3500, ["疯狂暴走", "极限吃货"],
        "48H 怒刷东京，人均 ¥3500 暴走攻略",
        [
            _leg(0, "2026-04-05T09:00:00", "2026-04-05T10:30:00", "food", "筑地场外市场", 35.6654, 139.7707, "metro", 80, ["玉子烧和海鲜丼早餐"], "日比谷线→筑地站"),
            _leg(1, "2026-04-05T11:00:00", "2026-04-05T13:00:00", "attraction", "浅草寺", 35.7148, 139.7967, "metro", 20, ["雷门必拍"], "银座线→浅草站"),
            _leg(2, "2026-04-05T14:00:00", "2026-04-05T17:00:00", "shopping", "秋叶原电器街", 35.7023, 139.7745, "metro", 300, ["免税店集中"], "JR秋叶原站"),
            _leg(3, "2026-04-06T10:00:00", "2026-04-06T13:00:00", "attraction", "明治神宫 + 原宿", 35.6764, 139.6993, "metro", 60, ["森林神社和潮流街并线"], "JR原宿站"),
        ],
    ),
    _preset(
        "大阪", Continent.ASIA.value, "EastAsia", 72, 4200, ["极限吃货", "乐园控"],
        "72H 大阪吃货 + USJ 全开，¥4200 冲刺版",
        [
            _leg(0, "2026-04-10T09:00:00", "2026-04-10T11:00:00", "food", "黑门市场", 34.6620, 135.5069, "metro", 80, ["刺身和和牛串起步"], "日本桥站"),
            _leg(1, "2026-04-10T12:00:00", "2026-04-10T15:00:00", "shopping", "心斋桥筋商店街", 34.6722, 135.5017, "walk", 260, ["药妆和潮牌密集"]),
            _leg(2, "2026-04-11T09:00:00", "2026-04-11T16:00:00", "attraction", "环球影城 USJ", 34.6654, 135.4323, "train", 350, ["快速票节省排队"], "JR梦咲线"),
            _leg(3, "2026-04-12T10:00:00", "2026-04-12T13:00:00", "food", "道顿堀", 34.6687, 135.5013, "metro", 90, ["章鱼烧+大阪烧压轴"], "难波站"),
        ],
    ),
    _preset(
        "福冈", Continent.ASIA.value, "EastAsia", 24, 1600, ["极限吃货", "城市漫游"],
        "福冈 24H 拉面快闪，¥1600 轻装版",
        [
            _leg(0, "2026-04-18T08:00:00", "2026-04-18T09:00:00", "food", "元祖长滨屋", 33.5956, 130.3924, "taxi", 35, ["豚骨拉面开门即吃"]),
            _leg(1, "2026-04-18T10:00:00", "2026-04-18T12:00:00", "attraction", "大濠公园", 33.5866, 130.3763, "metro", 0, ["晨间散步很舒服"], "空港线大濠公园站"),
            _leg(2, "2026-04-18T13:00:00", "2026-04-18T17:00:00", "shopping", "天神地下街", 33.5902, 130.4017, "metro", 200, ["买手店很集中"], "天神站"),
        ],
    ),
    _preset(
        "札幌", Continent.ASIA.value, "EastAsia", 48, 2800, ["极限吃货", "雪国体验"],
        "札幌 48H 雪国食堂巡礼，¥2800 进阶版",
        [
            _leg(0, "2026-02-06T09:00:00", "2026-02-06T11:00:00", "food", "二条市场", 43.0585, 141.3599, "metro", 90, ["海鲜盖饭必吃"], "大通站"),
            _leg(1, "2026-02-06T12:00:00", "2026-02-06T15:00:00", "attraction", "白色恋人工厂", 43.0887, 141.2710, "metro", 60, ["冬季限定氛围很强"], "东西线宫之泽站"),
            _leg(2, "2026-02-07T10:00:00", "2026-02-07T13:00:00", "attraction", "藻岩山展望台", 43.0222, 141.3216, "bus", 90, ["夜景值回票价"], "缆车接驳"),
        ],
    ),
    _preset(
        "首尔", Continent.ASIA.value, "EastAsia", 48, 2000, ["疯狂暴走", "打卡狂魔"],
        "48H 首尔暴走，¥2000 韩流朝圣",
        [
            _leg(0, "2026-05-01T09:00:00", "2026-05-01T11:00:00", "attraction", "景福宫", 37.5796, 126.9770, "metro", 15, ["韩服可免票"], "3号线景福宫站"),
            _leg(1, "2026-05-01T14:00:00", "2026-05-01T16:00:00", "shopping", "明洞", 37.5636, 126.9860, "metro", 200, ["美妆免税密集"], "4号线明洞站"),
            _leg(2, "2026-05-02T13:00:00", "2026-05-02T15:00:00", "food", "广藏市场", 37.5700, 127.0100, "metro", 40, ["麻药紫菜饭卷"], "1号线钟路5街站"),
        ],
    ),
    _preset(
        "台北", Continent.ASIA.value, "EastAsia", 72, 2200, ["夜市王者", "山城打卡"],
        "台北 72H 夜市 + 山城全吃透，¥2200 深度版",
        [
            _leg(0, "2026-05-25T08:00:00", "2026-05-25T09:30:00", "food", "永和豆浆大王", 25.0330, 121.5654, "metro", 10, ["烧饼油条起手"], "东门站"),
            _leg(1, "2026-05-25T10:30:00", "2026-05-25T13:00:00", "attraction", "台北故宫博物院", 25.1024, 121.5485, "bus", 25, ["热门馆藏密集"], "红30路"),
            _leg(2, "2026-05-26T09:00:00", "2026-05-26T13:00:00", "attraction", "九份老街", 25.1094, 121.8441, "bus", 30, ["山城茶屋和灯笼"], "1062路"),
            _leg(3, "2026-05-27T18:00:00", "2026-05-27T21:00:00", "food", "饶河夜市", 25.0509, 121.5776, "metro", 40, ["胡椒饼收官"], "松山站"),
        ],
    ),
    # ── Southeast Asia ──
    _preset(
        "曼谷", Continent.ASIA.value, "SoutheastAsia", 24, 200, ["极限吃货", "打卡狂魔"],
        "曼谷 24H 极限吃货路线，¥200 封顶",
        [
            _leg(0, "2026-04-01T07:00:00", "2026-04-01T08:00:00", "food", "胜利纪念碑船面", 13.7650, 100.5388, "metro", 8, ["一碗才40泰铢"], "BTS胜利纪念碑站"),
            _leg(1, "2026-04-01T08:30:00", "2026-04-01T10:30:00", "attraction", "大皇宫", 13.7500, 100.4913, "bus", 35, ["穿着需规范"], "公交船→Tha Chang"),
            _leg(2, "2026-04-01T19:00:00", "2026-04-01T21:00:00", "food", "拉差达火车夜市", 13.7647, 100.5734, "metro", 30, ["夜市收官最合适"], "MRT文化中心站"),
        ],
    ),
    _preset(
        "清迈", Continent.ASIA.value, "SoutheastAsia", 48, 400, ["穷游慢生活", "寺庙巡礼"],
        "48H 清迈慢生活，¥400 佛系穷游",
        [
            _leg(0, "2026-04-20T08:00:00", "2026-04-20T09:30:00", "food", "凤飞飞猪脚饭", 18.7953, 98.9845, "taxi", 8, ["北门招牌小吃"], "双条车"),
            _leg(1, "2026-04-20T10:00:00", "2026-04-20T12:00:00", "attraction", "双龙寺", 18.8049, 98.9218, "taxi", 15, ["山顶俯瞰全城"], "双条车上山"),
            _leg(2, "2026-04-21T18:00:00", "2026-04-21T21:00:00", "food", "塔佩门夜市", 18.7869, 99.0002, "walk", 25, ["夜市摊密度高"]),
        ],
    ),
    _preset(
        "新加坡", Continent.ASIA.value, "SoutheastAsia", 72, 2200, ["城市打卡", "家庭友好"],
        "新加坡 72H 城市花园全景，¥2200 舒适版",
        [
            _leg(0, "2026-04-15T09:00:00", "2026-04-15T11:00:00", "attraction", "滨海湾花园", 1.2816, 103.8636, "metro", 60, ["Cloud Forest值得买票"], "Bayfront站"),
            _leg(1, "2026-04-16T10:00:00", "2026-04-16T14:00:00", "attraction", "圣淘沙岛", 1.2494, 103.8303, "metro", 120, ["海岛一日线很省心"], "圣淘沙捷运"),
            _leg(2, "2026-04-17T18:00:00", "2026-04-17T20:00:00", "food", "麦士威熟食中心", 1.2803, 103.8448, "metro", 25, ["海南鸡饭压轴"], "Chinatown站"),
        ],
    ),
    _preset(
        "普吉岛", Continent.ASIA.value, "SoutheastAsia", 72, 1800, ["海岛躺平", "潜水体验"],
        "普吉岛 72H 海岛治愈，¥1800 浮潜版",
        [
            _leg(0, "2026-06-12T10:00:00", "2026-06-12T13:00:00", "attraction", "卡伦海滩", 7.8467, 98.2946, "taxi", 0, ["上午人少更适合玩水"]),
            _leg(1, "2026-06-13T08:00:00", "2026-06-13T15:00:00", "attraction", "皇帝岛浮潜", 7.6000, 98.3667, "bus", 220, ["拼船性价比高"], "码头接驳"),
            _leg(2, "2026-06-14T18:00:00", "2026-06-14T20:00:00", "food", "普吉镇夜市", 7.8804, 98.3923, "taxi", 35, ["海鲜和甜品都集中"]),
        ],
    ),
    _preset(
        "槟城", Continent.ASIA.value, "SoutheastAsia", 24, 500, ["街头美食", "古城打卡"],
        "槟城 24H 壁画 + 小吃暴走，¥500 精华版",
        [
            _leg(0, "2026-06-20T08:00:00", "2026-06-20T09:30:00", "food", "多春茶室", 5.4185, 100.3380, "walk", 20, ["炭烤吐司早餐"], None),
            _leg(1, "2026-06-20T10:00:00", "2026-06-20T13:00:00", "attraction", "乔治市街头壁画", 5.4141, 100.3288, "walk", 0, ["适合边走边拍"]),
            _leg(2, "2026-06-20T18:00:00", "2026-06-20T21:00:00", "food", "新关仔角夜市", 5.4378, 100.3106, "taxi", 35, ["沙爹和福建面必吃"]),
        ],
    ),
    _preset(
        "巴厘岛", Continent.ASIA.value, "SoutheastAsia", 72, 1200, ["打卡狂魔", "疯狂暴走"],
        "72H 巴厘岛海岛穷游，¥1200 神仙体验",
        [
            _leg(0, "2026-05-10T10:00:00", "2026-05-10T12:00:00", "attraction", "海神庙", -8.6212, 115.0868, "taxi", 20, ["日落超值"], "Grab Bike"),
            _leg(1, "2026-05-11T08:00:00", "2026-05-11T12:00:00", "attraction", "蓝梦岛浮潜", -8.6816, 115.4450, "bus", 120, ["提前预定含接送"], "快艇"),
            _leg(2, "2026-05-12T06:00:00", "2026-05-12T10:00:00", "attraction", "巴图尔火山日出", -8.2417, 115.3750, "taxi", 80, ["凌晨出发更稳妥"], "包车拼团"),
        ],
    ),
    _preset(
        "胡志明市", Continent.ASIA.value, "SoutheastAsia", 48, 350, ["穷鬼免税店", "极限吃货"],
        "48H 怒刷胡志明市，人均 ¥350 挑战",
        [
            _leg(0, "2026-03-20T08:30:00", "2026-03-20T09:30:00", "food", "Phở Hòa Pasteur", 10.7769, 106.6896, "bus", 15, ["当地人常去牛肉粉"], "109路公交"),
            _leg(1, "2026-03-20T10:00:00", "2026-03-20T12:00:00", "attraction", "统一宫", 10.7769, 106.6955, "walk", 10, ["了解城市历史"], None),
            _leg(2, "2026-03-20T18:00:00", "2026-03-20T20:00:00", "food", "范五老街", 10.7676, 106.6932, "walk", 25, ["夜生活氛围强"]),
        ],
    ),
    # ── Europe / UK ──
    _preset(
        "伦敦", Continent.EUROPE.value, "UK", 24, 2200, ["打卡狂魔", "博物馆"],
        "伦敦 24H 王炸打卡，¥2200 快闪版",
        [
            _leg(0, "2026-07-01T08:00:00", "2026-07-01T10:00:00", "attraction", "白金汉宫", 51.5014, -0.1419, "metro", 0, ["换岗仪式看时间"]),
            _leg(1, "2026-07-01T11:00:00", "2026-07-01T14:00:00", "attraction", "大英博物馆", 51.5194, -0.1270, "metro", 0, ["免费但建议预约"], "Tottenham Court Road"),
            _leg(2, "2026-07-01T18:00:00", "2026-07-01T20:00:00", "attraction", "伦敦眼 + 泰晤士河", 51.5033, -0.1195, "metro", 220, ["日落时间最好拍"], "Waterloo"),
        ],
    ),
    _preset(
        "伦敦", Continent.EUROPE.value, "UK", 48, 3200, ["城市暴走", "经典必刷"],
        "伦敦 48H 城市经典全收，¥3200 深挖版",
        [
            _leg(0, "2026-07-02T09:00:00", "2026-07-02T11:00:00", "attraction", "西敏寺 + 国会大厦", 51.4993, -0.1273, "metro", 180, ["建筑细节非常震撼"], "Westminster"),
            _leg(1, "2026-07-02T13:00:00", "2026-07-02T16:00:00", "shopping", "科文特花园", 51.5117, -0.1240, "metro", 260, ["买手小店多"], "Covent Garden"),
            _leg(2, "2026-07-03T10:00:00", "2026-07-03T13:00:00", "attraction", "塔桥 + 伦敦塔", 51.5055, -0.1154, "metro", 260, ["历史线最完整"], "Tower Hill"),
        ],
    ),
    _preset(
        "爱丁堡", Continent.EUROPE.value, "UK", 72, 2800, ["古堡巡礼", "电影感"],
        "爱丁堡 72H 中世纪山城，¥2800 沉浸版",
        [
            _leg(0, "2026-07-10T09:00:00", "2026-07-10T12:00:00", "attraction", "爱丁堡城堡", 55.9486, -3.1999, "walk", 180, ["山顶视野非常值"], None),
            _leg(1, "2026-07-11T08:00:00", "2026-07-11T11:00:00", "attraction", "亚瑟王座", 55.9445, -3.1617, "walk", 0, ["清晨登顶最舒服"], None),
            _leg(2, "2026-07-12T13:00:00", "2026-07-12T16:00:00", "food", "维多利亚街酒馆区", 55.9482, -3.1931, "walk", 120, ["适合慢逛和收尾"]),
        ],
    ),
    _preset(
        "曼彻斯特", Continent.EUROPE.value, "UK", 48, 2300, ["工业城市", "球迷朝圣"],
        "曼彻斯特 48H 城市文化线，¥2300 英伦版",
        [
            _leg(0, "2026-07-15T10:00:00", "2026-07-15T12:00:00", "attraction", "曼彻斯特大教堂", 53.4858, -2.2449, "walk", 0, ["老城核心区域"]),
            _leg(1, "2026-07-15T14:00:00", "2026-07-15T17:00:00", "attraction", "老特拉福德球场", 53.4631, -2.2913, "metro", 160, ["球迷很值得"], "Metrolink"),
            _leg(2, "2026-07-16T11:00:00", "2026-07-16T14:00:00", "shopping", "Northern Quarter", 53.4838, -2.2346, "walk", 200, ["黑胶和咖啡店扎堆"]),
        ],
    ),
    _preset(
        "利物浦", Continent.EUROPE.value, "UK", 24, 1800, ["音乐朝圣", "海港城市"],
        "利物浦 24H 披头士快闪，¥1800 经典版",
        [
            _leg(0, "2026-07-18T09:00:00", "2026-07-18T11:00:00", "attraction", "阿尔伯特码头", 53.4008, -2.9946, "walk", 0, ["海港拍照氛围很好"]),
            _leg(1, "2026-07-18T12:00:00", "2026-07-18T14:00:00", "attraction", "披头士故事馆", 53.4004, -2.9920, "walk", 150, ["乐迷必刷"]),
            _leg(2, "2026-07-18T18:00:00", "2026-07-18T20:00:00", "food", "Bold Street", 53.4036, -2.9817, "walk", 100, ["餐厅选择非常多"]),
        ],
    ),
    _preset(
        "巴黎", Continent.EUROPE.value, "ContinentalEurope", 48, 3200, ["浪漫打卡", "博物馆"],
        "巴黎 48H 城市光影巡礼，¥3200 经典版",
        [
            _leg(0, "2026-08-01T09:00:00", "2026-08-01T12:00:00", "attraction", "卢浮宫", 48.8606, 2.3376, "metro", 180, ["提前预约省排队"], "Palais Royal"),
            _leg(1, "2026-08-01T16:00:00", "2026-08-01T18:00:00", "attraction", "埃菲尔铁塔", 48.8584, 2.2945, "metro", 220, ["黄昏最美"], "Bir-Hakeim"),
            _leg(2, "2026-08-02T10:00:00", "2026-08-02T13:00:00", "shopping", "玛黑区", 48.8575, 2.3622, "metro", 260, ["设计师店很多"]),
        ],
    ),
    _preset(
        "罗马", Continent.EUROPE.value, "ContinentalEurope", 72, 2800, ["古迹控", "徒步线"],
        "罗马 72H 古城穿越，¥2800 深度版",
        [
            _leg(0, "2026-08-10T09:00:00", "2026-08-10T12:00:00", "attraction", "斗兽场", 41.8902, 12.4922, "metro", 160, ["热门景点提前预约"], "Colosseo"),
            _leg(1, "2026-08-11T09:30:00", "2026-08-11T12:00:00", "attraction", "梵蒂冈博物馆", 41.9065, 12.4536, "metro", 220, ["清晨进场最省时间"], "Ottaviano"),
            _leg(2, "2026-08-12T18:00:00", "2026-08-12T20:00:00", "food", "特拉斯提弗列区", 41.8897, 12.4708, "metro", 110, ["晚餐和夜景很好结合"], "Tram 8"),
        ],
    ),
    _preset(
        "巴塞罗那", Continent.EUROPE.value, "ContinentalEurope", 24, 1800, ["建筑巡礼", "地中海"],
        "巴塞罗那 24H 高迪暴走，¥1800 精华版",
        [
            _leg(0, "2026-08-15T08:30:00", "2026-08-15T10:30:00", "attraction", "圣家堂", 41.4036, 2.1744, "metro", 210, ["建议预约早场"], "Sagrada Familia"),
            _leg(1, "2026-08-15T11:00:00", "2026-08-15T13:00:00", "attraction", "格拉西亚大道", 41.3917, 2.1649, "walk", 0, ["巴特罗之家沿线可顺刷"]),
            _leg(2, "2026-08-15T18:00:00", "2026-08-15T20:00:00", "food", "巴塞罗内塔海滩", 41.3763, 2.1924, "metro", 120, ["海边晚餐体验强"], "Barceloneta"),
        ],
    ),
    _preset(
        "阿姆斯特丹", Continent.EUROPE.value, "ContinentalEurope", 48, 2600, ["运河城市", "博物馆"],
        "阿姆斯特丹 48H 运河慢游，¥2600 轻松版",
        [
            _leg(0, "2026-08-20T09:00:00", "2026-08-20T12:00:00", "attraction", "梵高博物馆", 52.3584, 4.8811, "metro", 160, ["预约是关键"], "Museumplein"),
            _leg(1, "2026-08-20T14:00:00", "2026-08-20T16:00:00", "shopping", "九条街区", 52.3731, 4.8836, "metro", 220, ["小众买手店多"], "Westermarkt"),
            _leg(2, "2026-08-21T10:00:00", "2026-08-21T12:00:00", "attraction", "运河游船", 52.3702, 4.8952, "walk", 120, ["适合放缓节奏"]),
        ],
    ),
    # ── South America ──
    _preset(
        "里约热内卢", Continent.SOUTH_AMERICA.value, "LatinAmerica", 24, 2200, ["海滩打卡", "城市景观"],
        "里约 24H 山海快闪，¥2200 精华版",
        [
            _leg(0, "2026-09-01T08:00:00", "2026-09-01T10:00:00", "attraction", "基督像", -22.9519, -43.2105, "taxi", 180, ["清晨云层更稳"], "官方摆渡"),
            _leg(1, "2026-09-01T11:30:00", "2026-09-01T14:00:00", "attraction", "科帕卡巴纳海滩", -22.9711, -43.1822, "taxi", 0, ["海滩散步和拍照足够"], None),
            _leg(2, "2026-09-01T18:00:00", "2026-09-01T20:00:00", "food", "伊帕内玛餐吧区", -22.9847, -43.1986, "taxi", 150, ["夜晚更热闹"]),
        ],
    ),
    _preset(
        "里约热内卢", Continent.SOUTH_AMERICA.value, "LatinAmerica", 48, 3000, ["山海全收", "缆车体验"],
        "里约 48H 山海缆车双修，¥3000 进阶版",
        [
            _leg(0, "2026-09-02T09:00:00", "2026-09-02T12:00:00", "attraction", "面包山", -22.9486, -43.1566, "taxi", 220, ["日落推荐"], "缆车"),
            _leg(1, "2026-09-02T14:00:00", "2026-09-02T17:00:00", "shopping", "塞勒隆阶梯 + 拉帕区", -22.9156, -43.1795, "taxi", 80, ["街头艺术密集"]),
            _leg(2, "2026-09-03T10:00:00", "2026-09-03T13:00:00", "food", "圣特雷莎区", -22.9214, -43.1885, "taxi", 140, ["小酒馆氛围好"]),
        ],
    ),
    _preset(
        "圣保罗", Continent.SOUTH_AMERICA.value, "LatinAmerica", 72, 2600, ["都市文化", "博物馆"],
        "圣保罗 72H 都市艺术狂飙，¥2600 深度版",
        [
            _leg(0, "2026-09-05T10:00:00", "2026-09-05T12:00:00", "attraction", "圣保罗艺术博物馆", -23.5614, -46.6559, "metro", 90, ["城市艺术地标"], "Trianon-Masp"),
            _leg(1, "2026-09-06T09:00:00", "2026-09-06T12:00:00", "attraction", "伊比拉普埃拉公园", -23.5874, -46.6576, "taxi", 0, ["适合半天慢逛"]),
            _leg(2, "2026-09-07T18:00:00", "2026-09-07T21:00:00", "food", "Vila Madalena", -23.5617, -46.6911, "taxi", 120, ["夜生活和涂鸦墙并存"]),
        ],
    ),
    _preset(
        "布宜诺斯艾利斯", Continent.SOUTH_AMERICA.value, "LatinAmerica", 48, 2400, ["探戈之城", "欧洲感"],
        "布宜诺斯艾利斯 48H 探戈漫游，¥2400 优雅版",
        [
            _leg(0, "2026-09-10T09:00:00", "2026-09-10T12:00:00", "attraction", "五月广场", -34.6081, -58.3702, "metro", 0, ["历史核心区"]),
            _leg(1, "2026-09-10T14:00:00", "2026-09-10T17:00:00", "shopping", "圣特尔莫", -34.6213, -58.3738, "walk", 140, ["古董集市值得逛"]),
            _leg(2, "2026-09-11T19:00:00", "2026-09-11T21:00:00", "food", "巴勒莫 Soho", -34.5875, -58.4300, "taxi", 150, ["探戈晚餐体验"]),
        ],
    ),
    _preset(
        "利马", Continent.SOUTH_AMERICA.value, "LatinAmerica", 24, 1500, ["海岸城市", "美食"],
        "利马 24H 太平洋岸线，¥1500 快速版",
        [
            _leg(0, "2026-09-14T09:00:00", "2026-09-14T11:00:00", "attraction", "米拉弗洛雷斯海岸", -12.1289, -77.0305, "taxi", 0, ["悬崖海景很震撼"]),
            _leg(1, "2026-09-14T12:00:00", "2026-09-14T14:00:00", "food", "Surquillo 市场", -12.1187, -77.0251, "taxi", 80, ["海鲜和酸橘汁腌鱼"]),
            _leg(2, "2026-09-14T17:00:00", "2026-09-14T19:00:00", "attraction", "爱情公园", -12.1322, -77.0300, "walk", 0, ["黄昏适合拍照"]),
        ],
    ),
    _preset(
        "圣地亚哥", Continent.SOUTH_AMERICA.value, "LatinAmerica", 72, 2300, ["山城视角", "葡萄酒"],
        "圣地亚哥 72H 安第斯山下，¥2300 慢游版",
        [
            _leg(0, "2026-09-18T09:00:00", "2026-09-18T11:30:00", "attraction", "圣卢西亚山", -33.4405, -70.6437, "metro", 0, ["俯瞰市区最直接"], "Santa Lucia"),
            _leg(1, "2026-09-19T10:00:00", "2026-09-19T15:00:00", "attraction", "瓦尔帕莱索一日线", -33.0472, -71.6127, "bus", 180, ["彩色海港城市很出片"], "城际巴士"),
            _leg(2, "2026-09-20T18:00:00", "2026-09-20T20:00:00", "food", "Bellavista", -33.4333, -70.6344, "metro", 120, ["餐吧集中"], "Baquedano"),
        ],
    ),
    # ── Africa ──
    _preset(
        "开罗", Continent.AFRICA.value, "NorthAfrica", 24, 2000, ["古迹控", "金字塔"],
        "开罗 24H 金字塔快闪，¥2000 核心版",
        [
            _leg(0, "2026-10-01T08:00:00", "2026-10-01T12:00:00", "attraction", "吉萨金字塔", 29.9792, 31.1342, "taxi", 220, ["建议早去避晒"], "包车"),
            _leg(1, "2026-10-01T14:00:00", "2026-10-01T16:00:00", "attraction", "埃及博物馆", 30.0478, 31.2336, "taxi", 120, ["法老文物密集"]),
            _leg(2, "2026-10-01T18:00:00", "2026-10-01T20:00:00", "food", "汗哈利利市场", 30.0478, 31.2625, "taxi", 80, ["夜晚氛围更浓"]),
        ],
    ),
    _preset(
        "开罗", Continent.AFRICA.value, "NorthAfrica", 48, 2600, ["古城漫游", "博物馆"],
        "开罗 48H 尼罗河文明线，¥2600 进阶版",
        [
            _leg(0, "2026-10-02T09:00:00", "2026-10-02T12:00:00", "attraction", "萨拉丁城堡", 30.0287, 31.2619, "taxi", 100, ["城市全景不错"]),
            _leg(1, "2026-10-02T18:00:00", "2026-10-02T20:00:00", "attraction", "尼罗河夜游", 30.0444, 31.2357, "taxi", 180, ["夜景更适合体验"]),
            _leg(2, "2026-10-03T10:00:00", "2026-10-03T12:00:00", "food", "Zamalek", 30.0626, 31.2197, "taxi", 100, ["餐厅和咖啡馆集中"]),
        ],
    ),
    _preset(
        "马拉喀什", Continent.AFRICA.value, "NorthAfrica", 72, 2400, ["异域市集", "庭院酒店"],
        "马拉喀什 72H 红城沉浸，¥2400 摩洛哥版",
        [
            _leg(0, "2026-10-05T09:00:00", "2026-10-05T12:00:00", "attraction", "杰马夫纳广场", 31.6258, -7.9892, "walk", 0, ["白天晚上完全两种氛围"]),
            _leg(1, "2026-10-06T10:00:00", "2026-10-06T12:00:00", "attraction", "马约尔花园", 31.6416, -8.0028, "taxi", 120, ["颜色非常出片"]),
            _leg(2, "2026-10-07T18:00:00", "2026-10-07T20:00:00", "food", "旧城屋顶餐厅", 31.6295, -7.9811, "walk", 150, ["看日落很值"]),
        ],
    ),
    _preset(
        "开普敦", Continent.AFRICA.value, "SubSaharanAfrica", 48, 3200, ["山海景观", "公路线"],
        "开普敦 48H 山海公路，¥3200 震撼版",
        [
            _leg(0, "2026-10-10T08:00:00", "2026-10-10T11:00:00", "attraction", "桌山", -33.9628, 18.4098, "taxi", 220, ["风大时要看开放情况"], "缆车"),
            _leg(1, "2026-10-10T13:00:00", "2026-10-10T17:00:00", "attraction", "坎普斯湾", -33.9500, 18.3770, "taxi", 0, ["海滩和餐厅一线串联"]),
            _leg(2, "2026-10-11T09:00:00", "2026-10-11T16:00:00", "attraction", "好望角", -34.3568, 18.4740, "taxi", 260, ["包车路线最方便"]),
        ],
    ),
    _preset(
        "内罗毕", Continent.AFRICA.value, "SubSaharanAfrica", 24, 1800, ["城市野生动物", "自然体验"],
        "内罗毕 24H 城市野趣，¥1800 体验版",
        [
            _leg(0, "2026-10-15T08:00:00", "2026-10-15T11:30:00", "attraction", "内罗毕国家公园", -1.3733, 36.8588, "taxi", 260, ["半天 safari 很高效"]),
            _leg(1, "2026-10-15T13:00:00", "2026-10-15T15:00:00", "attraction", "长颈鹿中心", -1.3737, 36.7447, "taxi", 100, ["互动体验强"]),
            _leg(2, "2026-10-15T18:00:00", "2026-10-15T20:00:00", "food", "Karen 区餐厅", -1.3195, 36.7073, "taxi", 120, ["适合结束一天"]),
        ],
    ),
    _preset(
        "桑给巴尔", Continent.AFRICA.value, "SubSaharanAfrica", 72, 2200, ["海岛治愈", "香料文化"],
        "桑给巴尔 72H 海岛慢浪，¥2200 度假版",
        [
            _leg(0, "2026-10-20T09:00:00", "2026-10-20T12:00:00", "attraction", "石头城", -6.1659, 39.2026, "walk", 0, ["古城适合慢逛"]),
            _leg(1, "2026-10-21T08:00:00", "2026-10-21T13:00:00", "attraction", "香料农场", -6.2000, 39.2500, "taxi", 120, ["很有在地特色"]),
            _leg(2, "2026-10-22T14:00:00", "2026-10-22T18:00:00", "attraction", "Nungwi 海滩", -5.7280, 39.2920, "taxi", 0, ["适合最后躺平"]),
        ],
    ),
    # ── North America ──
    _preset(
        "纽约", Continent.NORTH_AMERICA.value, "NorthAmericaCore", 48, 4200, ["城市暴走", "地标打卡"],
        "纽约 48H 摩天楼暴走，¥4200 经典版",
        [
            _leg(0, "2026-11-01T09:00:00", "2026-11-01T11:00:00", "attraction", "中央公园", 40.7829, -73.9654, "metro", 0, ["早晨慢走舒服"]),
            _leg(1, "2026-11-01T12:00:00", "2026-11-01T15:00:00", "shopping", "第五大道", 40.7608, -73.9755, "walk", 300, ["商店最集中"]),
            _leg(2, "2026-11-02T18:00:00", "2026-11-02T20:00:00", "attraction", "布鲁克林大桥夜景", 40.7061, -73.9969, "metro", 0, ["傍晚最出片"]),
        ],
    ),
    _preset(
        "洛杉矶", Continent.NORTH_AMERICA.value, "NorthAmericaCore", 72, 4600, ["公路文化", "影视打卡"],
        "洛杉矶 72H 公路光影，¥4600 自驾版",
        [
            _leg(0, "2026-11-10T09:00:00", "2026-11-10T11:00:00", "attraction", "格里菲斯天文台", 34.1184, -118.3004, "taxi", 0, ["俯瞰Hollywood标志"]),
            _leg(1, "2026-11-11T10:00:00", "2026-11-11T14:00:00", "attraction", "圣莫尼卡海滩", 34.0100, -118.4962, "taxi", 0, ["适合慢节奏"]),
            _leg(2, "2026-11-12T11:00:00", "2026-11-12T15:00:00", "shopping", "比佛利山庄", 34.0736, -118.4004, "taxi", 300, ["打卡和逛街一体"]),
        ],
    ),
    # ── Oceania ──
    _preset(
        "悉尼", Continent.OCEANIA.value, "OceaniaCore", 48, 3600, ["海港城市", "地标打卡"],
        "悉尼 48H 海港经典，¥3600 轻奢版",
        [
            _leg(0, "2026-12-01T09:00:00", "2026-12-01T11:00:00", "attraction", "悉尼歌剧院", -33.8568, 151.2153, "train", 220, ["可加导览"], "Circular Quay"),
            _leg(1, "2026-12-01T12:00:00", "2026-12-01T15:00:00", "attraction", "岩石区", -33.8599, 151.2090, "walk", 60, ["老城和码头线一起逛"]),
            _leg(2, "2026-12-02T10:00:00", "2026-12-02T14:00:00", "attraction", "邦迪海滩", -33.8908, 151.2743, "bus", 0, ["海边步道很值得"]),
        ],
    ),
    _preset(
        "墨尔本", Continent.OCEANIA.value, "OceaniaCore", 24, 2200, ["咖啡城市", "巷弄文化"],
        "墨尔本 24H 咖啡巷弄快闪，¥2200 轻文艺版",
        [
            _leg(0, "2026-12-05T08:30:00", "2026-12-05T10:00:00", "food", "Degraves Street", -37.8179, 144.9667, "walk", 80, ["咖啡馆集中"]),
            _leg(1, "2026-12-05T10:30:00", "2026-12-05T13:00:00", "attraction", "维州国立美术馆", -37.8226, 144.9689, "metro", 0, ["免费馆藏很强"], "免费电车区"),
            _leg(2, "2026-12-05T15:00:00", "2026-12-05T18:00:00", "shopping", "霍西尔巷 + Flinders", -37.8179, 144.9681, "walk", 120, ["街头艺术和买手店串联"]),
        ],
    ),
]

for preset in _PRESET_DATA:
    for alias in preset.get("aliases", []):
        _DEST_ALIASES.setdefault(alias.strip().lower(), preset["destination"])

_DEST_INDEX: dict[str, list[dict]] = defaultdict(list)
_CONTINENT_INDEX: dict[str, list[dict]] = defaultdict(list)
_SUB_REGION_INDEX: dict[str, list[dict]] = defaultdict(list)

for _preset_item in _PRESET_DATA:
    _DEST_INDEX[_preset_item["destination"]].append(_preset_item)
    _CONTINENT_INDEX[_preset_item["continent"]].append(_preset_item)
    _SUB_REGION_INDEX[_preset_item["sub_region"]].append(_preset_item)


def _match_score(
    preset: dict,
    total_hours: int,
    budget_amount: float,
    tags: list[str],
) -> float:
    score = 10.0

    p_hours = preset["total_hours"]
    hour_ratio = abs(total_hours - p_hours) / max(p_hours, 1)
    if hour_ratio > 0.5:
        return 0.0
    score += (1.0 - hour_ratio) * 5.0

    p_budget = preset["budget_amount"]
    if budget_amount > 0 and p_budget > 0:
        budget_ratio = abs(budget_amount - p_budget) / max(p_budget, 1)
        if budget_ratio > 0.6:
            return 0.0
        score += (1.0 - budget_ratio) * 3.0

    preset_tags = set(preset.get("tags", []))
    user_tags = set(tags)
    if preset_tags and user_tags:
        overlap = len(preset_tags & user_tags) / max(len(preset_tags | user_tags), 1)
        score += overlap * 2.0

    return score


def _build_preset_response(preset: dict) -> ItineraryGenerateResponse:
    legs = [ItineraryLeg(**leg) for leg in preset["legs"]]
    places = [leg.place for leg in legs if leg.place]
    maps_url = build_google_maps_url(places)
    total_cost = sum(leg.estimated_cost.amount for leg in legs)

    return ItineraryGenerateResponse(
        itinerary_id=f"preset-{preset['destination'].lower()}-{preset['total_hours']}h",
        title=preset["title"],
        summary=ItinerarySummary(
            total_hours=preset["total_hours"],
            estimated_total_cost=Money(amount=total_cost, currency=preset.get("currency", "CNY")),
        ),
        legs=legs,
        map=MapInfo(google_maps_deeplink=maps_url, waypoints_count=len(places)),
        source=SourceInfo(
            llm_provider="preset",
            model_name=f"built-in/{preset['continent']}/{preset['sub_region']}",
            cache_hit=False,
            is_preset=True,
        ),
    )


def _filter_candidates(
    normalized_destination: str,
    continent: str | None = None,
    sub_region: str | None = None,
) -> tuple[list[dict], bool]:
    candidates = list(_DEST_INDEX.get(normalized_destination, []))
    if not candidates:
        return [], False

    filtered = candidates
    if continent:
        continent_filtered = [p for p in filtered if p["continent"] == continent]
        if continent_filtered:
            filtered = continent_filtered
        else:
            return candidates, True

    if sub_region:
        sub_region_filtered = [p for p in filtered if p["sub_region"] == sub_region]
        if sub_region_filtered:
            filtered = sub_region_filtered
        else:
            return filtered, True

    return filtered, False


def find_preset(
    destination: str,
    total_hours: int,
    budget_amount: float,
    budget_currency: str = "CNY",
    tags: list[str] | None = None,
    continent: str | None = None,
    sub_region: str | None = None,
) -> Optional[ItineraryGenerateResponse]:
    normalized = _normalize_dest(destination)
    candidates, fell_back = _filter_candidates(normalized, continent, sub_region)

    if not candidates:
        logger.debug("No preset found for destination=%s (normalized=%s)", destination, normalized)
        return None

    tags = tags or []
    best_preset = None
    best_score = 0.0
    for preset in candidates:
        score = _match_score(preset, total_hours, budget_amount, tags)
        if score > best_score:
            best_score = score
            best_preset = preset

    if best_preset is None or best_score < 5.0:
        logger.debug("Preset candidates for %s but score too low (%.1f)", normalized, best_score)
        return None

    logger.info(
        "Preset match: dest=%s continent=%s sub_region=%s hours=%d budget=%.0f score=%.1f fallback=%s",
        normalized,
        continent,
        sub_region,
        total_hours,
        budget_amount,
        best_score,
        fell_back,
    )
    return _build_preset_response(best_preset)


def get_all_preset_destinations(continent: str | None = None, sub_region: str | None = None) -> list[str]:
    presets = _PRESET_DATA
    if continent:
        presets = [p for p in presets if p["continent"] == continent]
    if sub_region:
        presets = [p for p in presets if p["sub_region"] == sub_region]
    return sorted({p["destination"] for p in presets})


def get_preset_count(continent: str | None = None, sub_region: str | None = None) -> int:
    presets = _PRESET_DATA
    if continent:
        presets = [p for p in presets if p["continent"] == continent]
    if sub_region:
        presets = [p for p in presets if p["sub_region"] == sub_region]
    return len(presets)


def get_region_metadata() -> list[dict]:
    metadata: list[dict] = []
    continent_order = [
        Continent.ASIA.value,
        Continent.EUROPE.value,
        Continent.AFRICA.value,
        Continent.NORTH_AMERICA.value,
        Continent.SOUTH_AMERICA.value,
        Continent.OCEANIA.value,
    ]
    for continent in continent_order:
        presets = _CONTINENT_INDEX.get(continent, [])
        sub_regions = sorted({p["sub_region"] for p in presets})
        metadata.append(
            {
                "key": continent,
                "label": _REGION_LABELS[continent],
                "preset_count": len(presets),
                "hot_destinations": sorted({p["destination"] for p in presets})[:12],
                "sub_regions": [
                    {
                        "key": sub_region,
                        "label": _SUB_REGION_LABELS.get(sub_region, sub_region),
                        "preset_count": len(_SUB_REGION_INDEX.get(sub_region, [])),
                    }
                    for sub_region in sub_regions
                ],
            }
        )
    return metadata


def get_featured_sub_regions() -> list[dict]:
    keys = ["EastAsia", "SoutheastAsia", "ContinentalEurope", "UK", "LatinAmerica", "NorthAfrica", "SubSaharanAfrica"]
    return [
        {
            "key": key,
            "label": _SUB_REGION_LABELS.get(key, key),
            "preset_count": len(_SUB_REGION_INDEX.get(key, [])),
            "hot_destinations": sorted({p["destination"] for p in _SUB_REGION_INDEX.get(key, [])})[:10],
        }
        for key in keys
        if _SUB_REGION_INDEX.get(key)
    ]
