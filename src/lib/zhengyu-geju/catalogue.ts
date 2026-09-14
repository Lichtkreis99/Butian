export const GEJU_GROUP_LABELS = {
  yuan_dian: "垣殿",
  ri_yue: "日月",
  wu_xing: "五星",
  zong_he: "综合",
  gong_jia: "拱夹",
  ming_shen: "命身",
} as const;

export type GejuGroup = keyof typeof GEJU_GROUP_LABELS;

export interface GejuCatalogueEntry {
  name: string;
  group: GejuGroup;
  note: string;
}

// Conditions transcribed from the staged API samples. Classification fields are omitted.
export const GEJU_CATALOGUE: readonly GejuCatalogueEntry[] = [
  {
    name: "嗣星升殿",
    group: "yuan_dian",
    note: "男女宫主人庙升殿",
  },
  {
    name: "嗣星失垣",
    group: "yuan_dian",
    note: "男女宫主失垣",
  },
  {
    name: "日躔月度",
    group: "yuan_dian",
    note: "太阳失躔",
  },
  {
    name: "田星失躔",
    group: "yuan_dian",
    note: "田宅宫主失躔",
  },
  {
    name: "田星居垣",
    group: "yuan_dian",
    note: "田宅宫主入垣",
  },
  {
    name: "太阴朝斗",
    group: "ri_yue",
    note: "月在丑、躔斗宿",
  },
  {
    name: "水日会合",
    group: "ri_yue",
    note: "水与日同宫",
  },
  {
    name: "木炁失垣",
    group: "wu_xing",
    note: "木、炁皆失垣",
  },
  {
    name: "炁孛失垣",
    group: "wu_xing",
    note: "炁、孛皆失垣",
  },
  {
    name: "孛星失垣",
    group: "wu_xing",
    note: "孛所在地支五行克孛",
  },
  {
    name: "木入金乡",
    group: "wu_xing",
    note: "木星失垣",
  },
  {
    name: "木土相克",
    group: "wu_xing",
    note: "木土同宫",
  },
  {
    name: "炁星失垣",
    group: "wu_xing",
    note: "炁所在地支五行克炁",
  },
  {
    name: "计星失躔",
    group: "wu_xing",
    note: "计所在星宿五行克计",
  },
  {
    name: "金罗同克",
    group: "wu_xing",
    note: "金与罗同宫",
  },
  {
    name: "五曜环阳",
    group: "zong_he",
    note: "五星连成一块，太阳夹在其中",
  },
  {
    name: "四余捧月",
    group: "zong_he",
    note: "计、罗、炁、孛在黄经上捧月",
  },
  {
    name: "日月夹妻",
    group: "gong_jia",
    note: "日与月左右夹夫妻",
  },
  {
    name: "日月夹斗杓",
    group: "gong_jia",
    note: "日与月左右夹斗杓",
  },
  {
    name: "官福夹阳",
    group: "ming_shen",
    note: "福德、官禄宫主左右夹太阳",
  },
  {
    name: "命坐两歧",
    group: "ming_shen",
    note: "命度落宫歧或宿歧",
  },
  {
    name: "妻星失躔",
    group: "yuan_dian",
    note: "夫妻宫主失躔",
  },
  {
    name: "官星失躔",
    group: "yuan_dian",
    note: "官禄宫主失躔",
  },
  {
    name: "木星失躔",
    group: "yuan_dian",
    note: "木所在星宿五行克木",
  },
  {
    name: "田星升殿",
    group: "yuan_dian",
    note: "田宅宫主人庙升殿",
  },
  {
    name: "田星失垣",
    group: "yuan_dian",
    note: "田宅宫主失垣",
  },
  {
    name: "财星失躔",
    group: "yuan_dian",
    note: "财帛宫主失躔",
  },
  {
    name: "金星升殿",
    group: "yuan_dian",
    note: "金入本殿",
  },
  {
    name: "金星失垣",
    group: "yuan_dian",
    note: "金所在地支五行克金",
  },
  {
    name: "寒月单行",
    group: "ri_yue",
    note: "冬季孤月独行；昼生为喜、夜生为忌",
  },
  {
    name: "阴阳得地",
    group: "ri_yue",
    note: "日居东南，月居西北",
  },
  {
    name: "日出扶桑",
    group: "ri_yue",
    note: "太阳落入卯宫",
  },
  {
    name: "木打宝瓶",
    group: "wu_xing",
    note: "木星落入子宫",
  },
  {
    name: "土在木宫",
    group: "wu_xing",
    note: "土星失垣",
  },
  {
    name: "土水相激",
    group: "wu_xing",
    note: "水土同宫",
  },
  {
    name: "孛星失躔",
    group: "wu_xing",
    note: "孛所在星宿五行克孛",
  },
  {
    name: "火到金乡",
    group: "wu_xing",
    note: "火星落入辰宫",
  },
  {
    name: "罗犯太阳",
    group: "wu_xing",
    note: "罗与日同宫",
  },
  {
    name: "计孛交战",
    group: "wu_xing",
    note: "计与孛同宫",
  },
  {
    name: "金乘火位",
    group: "wu_xing",
    note: "金星失垣",
  },
  {
    name: "日月拱官",
    group: "gong_jia",
    note: "日与月三合拱官禄",
  },
  {
    name: "身坐两歧",
    group: "ming_shen",
    note: "身度落宫歧或宿歧",
  },
  {
    name: "身命升殿",
    group: "yuan_dian",
    note: "命度宿主与身度宿主皆升殿",
  },
  {
    name: "日居月位",
    group: "yuan_dian",
    note: "太阳失垣",
  },
  {
    name: "福星殿垣",
    group: "yuan_dian",
    note: "福德宫主同时入垣、升殿",
  },
  {
    name: "阴阳俱晦",
    group: "ri_yue",
    note: "晦朔且夜生",
  },
  {
    name: "木月清贵",
    group: "ri_yue",
    note: "木与月同宫，且非冬季晦朔",
  },
  {
    name: "水土对克",
    group: "wu_xing",
    note: "水的对宫见土",
  },
  {
    name: "火烧牛角",
    group: "wu_xing",
    note: "火星落入酉宫",
  },
  {
    name: "土孛混杂",
    group: "wu_xing",
    note: "土与孛同宫",
  },
  {
    name: "孛失躔垣",
    group: "wu_xing",
    note: "孛同时失垣、失躔",
  },
  {
    name: "炁日同宫",
    group: "wu_xing",
    note: "炁与日同宫",
  },
  {
    name: "罗星失躔",
    group: "wu_xing",
    note: "罗所在星宿五行克罗",
  },
  {
    name: "日月夹唐符",
    group: "gong_jia",
    note: "日与月左右夹唐符",
  },
  {
    name: "金水从阳",
    group: "ri_yue",
    note: "日与金、水同宫",
  },
  {
    name: "木孛符印",
    group: "wu_xing",
    note: "木与孛同宫",
  },
  {
    name: "水居土室",
    group: "wu_xing",
    note: "水星失垣",
  },
  {
    name: "火土高强",
    group: "wu_xing",
    note: "火土同宫，且非夏季",
  },
  {
    name: "火旺南离",
    group: "wu_xing",
    note: "火星落入午宫",
  },
  {
    name: "嗣星失躔",
    group: "yuan_dian",
    note: "男女宫主失躔",
  },
  {
    name: "嗣星居垣",
    group: "yuan_dian",
    note: "男女宫主入垣",
  },
  {
    name: "财星升殿",
    group: "yuan_dian",
    note: "财帛宫主人庙升殿",
  },
  {
    name: "日月失所",
    group: "ri_yue",
    note: "日居西北，月居东南",
  },
  {
    name: "土荧相会",
    group: "wu_xing",
    note: "火土同宫，土在丑",
  },
  {
    name: "木金对克",
    group: "wu_xing",
    note: "木的对宫见金",
  },
  {
    name: "罗计失垣",
    group: "wu_xing",
    note: "罗、计皆失垣",
  },
  {
    name: "炁失躔垣",
    group: "wu_xing",
    note: "炁同时失垣、失躔",
  },
  {
    name: "罗星失垣",
    group: "wu_xing",
    note: "罗所在地支五行克罗",
  },
  {
    name: "计星失垣",
    group: "wu_xing",
    note: "计所在地支五行克计",
  },
  {
    name: "四余独步",
    group: "zong_he",
    note: "计、罗、炁、孛各守一宫",
  },
  {
    name: "木星升殿",
    group: "yuan_dian",
    note: "木入本殿",
  },
  {
    name: "水星失垣",
    group: "yuan_dian",
    note: "水所在地支五行克水",
  },
  {
    name: "日月夹贵人",
    group: "gong_jia",
    note: "日与月左右夹贵人（昼天贵、夜玉贵）",
  },
  {
    name: "孤阳无辅",
    group: "ri_yue",
    note: "太阳独守一宫",
  },
  {
    name: "日西月东",
    group: "ri_yue",
    note: "日在申酉戌，月在寅卯辰",
  },
  {
    name: "木火对生",
    group: "wu_xing",
    note: "火的对宫见木",
  },
  {
    name: "孛罗交战",
    group: "wu_xing",
    note: "孛与罗同宫",
  },
  {
    name: "火孛共战",
    group: "wu_xing",
    note: "火与孛同宫",
  },
  {
    name: "金居日分",
    group: "wu_xing",
    note: "金星落入午宫",
  },
  {
    name: "官星居垣",
    group: "yuan_dian",
    note: "官禄宫主入垣",
  },
  {
    name: "火星失躔",
    group: "yuan_dian",
    note: "火所在星宿五行克火",
  },
  {
    name: "福星失躔",
    group: "yuan_dian",
    note: "福德宫主失躔",
  },
  {
    name: "荧惑居垣",
    group: "yuan_dian",
    note: "火星入本垣",
  },
  {
    name: "土木对克",
    group: "wu_xing",
    note: "土的对宫见木",
  },
  {
    name: "土计失垣",
    group: "wu_xing",
    note: "土、计皆失垣",
  },
  {
    name: "福官居官",
    group: "ming_shen",
    note: "福德、官禄宫主同落官禄",
  },
  {
    name: "官福失垣",
    group: "yuan_dian",
    note: "官禄、福德宫主皆失垣",
  },
  {
    name: "妻星失垣",
    group: "yuan_dian",
    note: "夫妻宫主失垣",
  },
  {
    name: "火星失垣",
    group: "yuan_dian",
    note: "火所在地支五行克火",
  },
  {
    name: "财星失垣",
    group: "yuan_dian",
    note: "财帛宫主失垣",
  },
  {
    name: "水临双女",
    group: "wu_xing",
    note: "水星落入巳宫",
  },
  {
    name: "水火相刑",
    group: "wu_xing",
    note: "水火同宫",
  },
  {
    name: "火居水地",
    group: "wu_xing",
    note: "火星失垣",
  },
  {
    name: "罗计中分",
    group: "wu_xing",
    note: "罗在午（与计对分）",
  },
  {
    name: "日陷奴宫",
    group: "ming_shen",
    note: "太阳落入奴仆宫",
  },
  {
    name: "官福失躔",
    group: "yuan_dian",
    note: "官禄、福德宫主皆失躔",
  },
  {
    name: "妻星居垣",
    group: "yuan_dian",
    note: "夫妻宫主入垣",
  },
  {
    name: "官失躔垣",
    group: "yuan_dian",
    note: "官禄宫主同时失垣、失躔",
  },
  {
    name: "福失躔垣",
    group: "yuan_dian",
    note: "福德宫主同时失垣、失躔",
  },
  {
    name: "财星居垣",
    group: "yuan_dian",
    note: "财帛宫主入垣",
  },
  {
    name: "金助月华",
    group: "ri_yue",
    note: "金与月同宫，且非昼生冬季",
  },
  {
    name: "金星失躔",
    group: "yuan_dian",
    note: "金所在星宿五行克金",
  },
  {
    name: "水木对生",
    group: "wu_xing",
    note: "木的对宫见水",
  },
  {
    name: "金在木宫",
    group: "wu_xing",
    note: "金星落入亥宫",
  },
  {
    name: "双鱼戏水",
    group: "zong_he",
    note: "命度与水同在亥",
  },
  {
    name: "田财失垣",
    group: "yuan_dian",
    note: "田宅、财帛宫主皆失垣",
  },
  {
    name: "土金对生",
    group: "wu_xing",
    note: "金的对宫见土",
  },
  {
    name: "孛犯太阳",
    group: "wu_xing",
    note: "孛与日同宫",
  },
  {
    name: "火照天门",
    group: "wu_xing",
    note: "火在亥、躔室宿",
  },
  {
    name: "炁星失躔",
    group: "wu_xing",
    note: "炁所在星宿五行克炁",
  },
  {
    name: "水火相射",
    group: "zong_he",
    note: "水在午且火在子，或水在火地、火在水地",
  },
  {
    name: "妻失躔垣",
    group: "yuan_dian",
    note: "夫妻宫主同时失垣、失躔",
  },
  {
    name: "田失躔垣",
    group: "yuan_dian",
    note: "田宅宫主同时失垣、失躔",
  },
  {
    name: "福星升殿",
    group: "yuan_dian",
    note: "福德宫主人庙升殿",
  },
  {
    name: "土计失躔",
    group: "wu_xing",
    note: "土、计皆失躔",
  },
  {
    name: "金骑人马",
    group: "wu_xing",
    note: "金星落入寅宫",
  },
  {
    name: "木罗会合",
    group: "wu_xing",
    note: "木与罗同宫",
  },
  {
    name: "官福殿垣",
    group: "yuan_dian",
    note: "官禄、福德宫主皆入垣或升殿",
  },
  {
    name: "土好宝瓶",
    group: "wu_xing",
    note: "土在子、躔虚宿",
  },
  {
    name: "金水相涵",
    group: "wu_xing",
    note: "金水同宫，且非冬季",
  },
  {
    name: "日月拱嗣",
    group: "gong_jia",
    note: "日与月三合拱男女",
  },
  {
    name: "日月拱岁殿",
    group: "gong_jia",
    note: "日与月三合拱岁殿",
  },
  {
    name: "福官居福",
    group: "ming_shen",
    note: "福德、官禄宫主同落福德",
  },
  {
    name: "日东月西",
    group: "ri_yue",
    note: "日在寅卯辰，月在申酉戌",
  },
  {
    name: "水乘火位",
    group: "wu_xing",
    note: "水星落入卯宫",
  },
  {
    name: "火金交战",
    group: "wu_xing",
    note: "金火同宫",
  },
  {
    name: "福官临田",
    group: "ming_shen",
    note: "福德、官禄宫主同落田宅",
  },
  {
    name: "妻嗣失垣",
    group: "yuan_dian",
    note: "夫妻、男女宫主皆失垣",
  },
  {
    name: "木星失垣",
    group: "yuan_dian",
    note: "木所在地支五行克木",
  },
  {
    name: "火月同宵",
    group: "ri_yue",
    note: "火与月同宫，且为夜生",
  },
  {
    name: "土号太常",
    group: "wu_xing",
    note: "土星落入丑宫",
  },
  {
    name: "官星失垣",
    group: "yuan_dian",
    note: "官禄宫主失垣",
  },
  {
    name: "妻嗣殿垣",
    group: "yuan_dian",
    note: "夫妻、男女宫主皆入垣或升殿",
  },
  {
    name: "水润金明",
    group: "wu_xing",
    note: "金水同宫于辰",
  },
  {
    name: "火土对生",
    group: "wu_xing",
    note: "土的对宫见火",
  },
  {
    name: "金木同宫",
    group: "wu_xing",
    note: "金木同宫",
  },
  {
    name: "斗杓指禄",
    group: "ming_shen",
    note: "官禄宫见斗杓",
  },
  {
    name: "福星失垣",
    group: "yuan_dian",
    note: "福德宫主失垣",
  },
  {
    name: "泉枯牛壑",
    group: "wu_xing",
    note: "水孛同宫于丑",
  },
  {
    name: "水孛失垣",
    group: "wu_xing",
    note: "水、孛皆失垣",
  },
  {
    name: "福官会聚",
    group: "ming_shen",
    note: "福德宫主与官禄宫主同宫",
  },
  {
    name: "福官临弱",
    group: "ming_shen",
    note: "福德、官禄宫主同入奴仆",
  },
  {
    name: "身坐刃乡",
    group: "ming_shen",
    note: "身度所在宫坐阳刃",
  },
  {
    name: "土星失垣",
    group: "yuan_dian",
    note: "土所在地支五行克土",
  },
  {
    name: "日居日位",
    group: "yuan_dian",
    note: "太阳入本垣",
  },
  {
    name: "白虎从驾",
    group: "ri_yue",
    note: "申酉月，金与日同宫",
  },
  {
    name: "日月拱妻",
    group: "gong_jia",
    note: "日与月三合拱夫妻",
  },
  {
    name: "玄武持旗",
    group: "ri_yue",
    note: "亥子月，水与日同宫",
  },
  {
    name: "福官互垣",
    group: "ming_shen",
    note: "福德与官禄宫主互相入垣",
  },
  {
    name: "岁星居垣",
    group: "yuan_dian",
    note: "木星入本垣",
  },
  {
    name: "月在沧海",
    group: "ri_yue",
    note: "太阴落入酉宫",
  },
  {
    name: "计犯太阳",
    group: "wu_xing",
    note: "计与日同宫",
  },
  {
    name: "水星失躔",
    group: "yuan_dian",
    note: "水所在星宿五行克水",
  },
  {
    name: "土居水地",
    group: "wu_xing",
    note: "土星落入申宫",
  },
  {
    name: "木入土室",
    group: "wu_xing",
    note: "木星落入丑宫",
  },
  {
    name: "妻星升殿",
    group: "yuan_dian",
    note: "夫妻宫主人庙升殿",
  },
  {
    name: "官星升殿",
    group: "yuan_dian",
    note: "官禄宫主人庙升殿",
  },
  {
    name: "孤月独明",
    group: "ri_yue",
    note: "太阴独守一宫，且为夜生",
  },
  {
    name: "水计相刑",
    group: "wu_xing",
    note: "水与计同宫",
  },
  {
    name: "金计同垣",
    group: "wu_xing",
    note: "金与计同宫",
  },
  {
    name: "五曜连珠",
    group: "zong_he",
    note: "五星在黄经上连成一块",
  },
  {
    name: "身命殿垣",
    group: "yuan_dian",
    note: "命度、身度宿主一升殿一入垣，或皆殿垣",
  },
  {
    name: "嗣星殿垣",
    group: "yuan_dian",
    note: "男女宫主同时入垣、升殿",
  },
  {
    name: "福星居垣",
    group: "yuan_dian",
    note: "福德宫主入垣",
  },
  {
    name: "金火对克",
    group: "wu_xing",
    note: "金的对宫见火",
  },
  {
    name: "土罗相会",
    group: "wu_xing",
    note: "土与罗同宫",
  },
  {
    name: "水附阳光",
    group: "ri_yue",
    note: "日、月、水三星同宫",
  },
  {
    name: "妻星殿垣",
    group: "yuan_dian",
    note: "夫妻宫主同时入垣、升殿",
  },
  {
    name: "月到日宫",
    group: "yuan_dian",
    note: "太阴失垣",
  },
  {
    name: "水泛白羊",
    group: "wu_xing",
    note: "水星落入戌宫",
  },
  {
    name: "日月拱财",
    group: "gong_jia",
    note: "日与月三合拱财帛",
  },
  {
    name: "山泽沉埋",
    group: "zong_he",
    note: "金在寅、木在酉",
  },
  {
    name: "日月夹驿马",
    group: "gong_jia",
    note: "日与月左右夹驿马",
  },
  {
    name: "土星失躔",
    group: "yuan_dian",
    note: "土所在星宿五行克土",
  },
  {
    name: "日南月北",
    group: "ri_yue",
    note: "日在巳午未，月在亥子丑",
  },
  {
    name: "福官守儿",
    group: "ming_shen",
    note: "福德、官禄宫主同落男女",
  },
  {
    name: "田财殿垣",
    group: "yuan_dian",
    note: "田宅、财帛宫主皆入垣或升殿",
  },
  {
    name: "戴天履地",
    group: "zong_he",
    note: "命度在亥，月在水地支",
  },
  {
    name: "日北月南",
    group: "ri_yue",
    note: "日在亥子丑，月在巳午未",
  },
  {
    name: "土埋双女",
    group: "wu_xing",
    note: "土星落入巳宫",
  },
  {
    name: "罗月交辉",
    group: "wu_xing",
    note: "月与罗同宫，晦朔夜生",
  },
  {
    name: "火罗犯日",
    group: "wu_xing",
    note: "日与火同宫，并与罗同宫",
  },
  {
    name: "田财失躔",
    group: "yuan_dian",
    note: "田宅、财帛宫主皆失躔",
  },
  {
    name: "嗣失躔垣",
    group: "yuan_dian",
    note: "男女宫主同时失垣、失躔",
  },
  {
    name: "月升月殿",
    group: "yuan_dian",
    note: "太阴入本殿",
  },
  {
    name: "财失躔垣",
    group: "yuan_dian",
    note: "财帛宫主同时失垣、失躔",
  },
  {
    name: "斗旺坐命",
    group: "ming_shen",
    note: "命度所在宫兼见斗杓、帝旺",
  },
  {
    name: "月躔日宿",
    group: "yuan_dian",
    note: "太阴失躔",
  },
  {
    name: "木火文明",
    group: "wu_xing",
    note: "木火同宫，且为冬春",
  },
  {
    name: "水星升殿",
    group: "yuan_dian",
    note: "水入本殿",
  },
  {
    name: "木炁失躔",
    group: "wu_xing",
    note: "木、炁皆失躔",
  },
  {
    name: "水孛逢楚",
    group: "wu_xing",
    note: "水孛同宫于巳",
  },
  {
    name: "日月夹禄勋",
    group: "gong_jia",
    note: "日与月左右夹禄勋",
  },
  {
    name: "青龙扶砚",
    group: "ri_yue",
    note: "寅卯月，木与日同宫",
  },
  {
    name: "木计逢鱼",
    group: "wu_xing",
    note: "木与计同宫于亥",
  },
  {
    name: "勾陈镇殿",
    group: "ri_yue",
    note: "辰戌丑未月，土与日同宫",
  },
  {
    name: "土金坚实",
    group: "wu_xing",
    note: "金土同宫，且为春夏",
  },
  {
    name: "日月拱岁驾",
    group: "gong_jia",
    note: "日与月三合拱岁驾",
  },
  {
    name: "身命两歧",
    group: "ming_shen",
    note: "命度、身度皆落宫歧或宿歧",
  },
  {
    name: "身命失垣",
    group: "yuan_dian",
    note: "命度宿主与身度宿主皆失垣",
  },
  {
    name: "田星殿垣",
    group: "yuan_dian",
    note: "田宅宫主同时入垣、升殿",
  },
  {
    name: "日月夹嗣",
    group: "gong_jia",
    note: "日与月左右夹男女",
  },
  {
    name: "金水辅阴",
    group: "ri_yue",
    note: "月与金、水同宫于申酉戌",
  },
  {
    name: "身命失躔",
    group: "yuan_dian",
    note: "命度宿主与身度宿主皆失躔",
  },
  {
    name: "日月拱紫微",
    group: "gong_jia",
    note: "日与月三合拱紫微",
  },
  {
    name: "官星殿垣",
    group: "yuan_dian",
    note: "官禄宫主同时入垣、升殿",
  },
  {
    name: "日月夹紫微",
    group: "gong_jia",
    note: "日与月左右夹紫微",
  },
] as const;
