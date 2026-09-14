export interface City {
  names: string[];
  longitude: number;
  latitude: number;
  timezoneOffset: number;
}

function city(
  names: string,
  longitude: number,
  latitude: number,
  timezoneOffset: number,
): City {
  return { names: names.split("|"), longitude, latitude, timezoneOffset };
}

export const cities: City[] = [
  city("台北市|台北|Taipei", 121.5, 25.05, 480),
  city("新北市|新北", 121.46, 25.01, 480),
  city("桃園市|桃園", 121.3, 24.99, 480),
  city("台中市|台中", 120.68, 24.15, 480),
  city("台南市|台南", 120.2, 22.99, 480),
  city("高雄市|高雄", 120.3, 22.63, 480),
  city("基隆市|基隆", 121.74, 25.13, 480),
  city("新竹市|新竹", 120.97, 24.81, 480),
  city("嘉義市|嘉義", 120.45, 23.48, 480),
  city("北京市|北京|Beijing", 116.3833, 39.9167, 480),
  city("上海市|上海|Shanghai", 121.47, 31.23, 480),
  city("天津市|天津", 117.2, 39.13, 480),
  city("重慶市|重慶", 106.55, 29.56, 480),
  city("香港|Hong Kong", 114.17, 22.32, 480),
  city("澳門|Macau", 113.54, 22.2, 480),
  city("廣州市|廣州|Guangzhou", 113.26, 23.13, 480),
  city("深圳市|深圳|Shenzhen", 114.06, 22.55, 480),
  city("南京市|南京", 118.8, 32.06, 480),
  city("杭州市|杭州", 120.16, 30.27, 480),
  city("福州市|福州", 119.3, 26.08, 480),
  city("廈門市|廈門|Xiamen", 118.09, 24.48, 480),
  city("濟南市|濟南", 117.12, 36.65, 480),
  city("青島市|青島|Qingdao", 120.38, 36.07, 480),
  city("瀋陽市|瀋陽", 123.43, 41.8, 480),
  city("長春市|長春", 125.32, 43.9, 480),
  city("哈爾濱市|哈爾濱", 126.53, 45.8, 480),
  city("石家莊市|石家莊", 114.51, 38.04, 480),
  city("鄭州市|鄭州", 113.63, 34.75, 480),
  city("武漢市|武漢", 114.31, 30.59, 480),
  city("長沙市|長沙", 112.94, 28.23, 480),
  city("南昌市|南昌", 115.86, 28.68, 480),
  city("合肥市|合肥", 117.23, 31.82, 480),
  city("太原市|太原", 112.55, 37.87, 480),
  city("西安市|西安|Xian", 108.94, 34.34, 480),
  city("成都市|成都", 104.07, 30.67, 480),
  city("昆明市|昆明", 102.71, 25.04, 480),
  city("貴陽市|貴陽", 106.63, 26.65, 480),
  city("南寧市|南寧", 108.32, 22.82, 480),
  city("海口市|海口", 110.2, 20.04, 480),
  city("蘭州市|蘭州", 103.84, 36.06, 480),
  city("西寧市|西寧", 101.78, 36.62, 480),
  city("銀川市|銀川", 106.23, 38.49, 480),
  city("烏魯木齊市|烏魯木齊", 87.62, 43.83, 480),
  city("呼和浩特市|呼和浩特", 111.75, 40.84, 480),
  city("拉薩市|拉薩", 91.13, 29.65, 480),
  city("東京|Tokyo", 139.69, 35.69, 540),
  city("首爾|Seoul", 126.98, 37.57, 540),
  city("新加坡|Singapore", 103.82, 1.35, 480),
  city("曼谷|Bangkok", 100.5, 13.75, 420),
  city("德里|Delhi", 77.21, 28.61, 330),
  city("杜拜|Dubai", 55.27, 25.2, 240),
  city("London|倫敦", -0.1167, 51.5, 0),
  city("Paris|巴黎", 2.35, 48.86, 60),
  city("Berlin|柏林", 13.41, 52.52, 60),
  city("Rome|羅馬", 12.5, 41.9, 60),
  city("Moscow|莫斯科", 37.62, 55.75, 180),
  city("Helsinki|赫爾辛基", 24.9333, 60.1667, 120),
  city("New York|紐約", -74.01, 40.71, -300),
  city("Los Angeles|洛杉磯", -118.24, 34.05, -480),
  city("Chicago|芝加哥", -87.63, 41.88, -360),
  city("Toronto|多倫多", -79.38, 43.65, -300),
  city("Mexico City|墨西哥城", -99.13, 19.43, -360),
  city("Buenos Aires|布宜諾斯艾利斯", -58.3833, -34.6, -180),
  city("São Paulo|Sao Paulo|聖保羅", -46.63, -23.55, -180),
  city("Sydney|雪梨", 151.21, -33.87, 600),
  city("Melbourne|墨爾本", 144.96, -37.81, 600),
];

export function findCity(query: string): City | undefined {
  const normalized = query.trim().toLocaleLowerCase();
  return cities.find((entry) => (
    entry.names.some((name) => name.toLocaleLowerCase() === normalized)
  ));
}
