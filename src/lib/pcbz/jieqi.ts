// @ts-nocheck -- lunar-javascript has no bundled TypeScript declaration.
import { Solar } from "lunar-javascript";

export interface JieqiMoment {
  name: string;
  time: string;
}

export function surroundingJieqi(solarDateTime: string): {
  previous: JieqiMoment;
  next: JieqiMoment;
} {
  const [date, time] = solarDateTime.split(" ");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const lunar = Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar();
  const format = (jie: unknown): JieqiMoment => ({
    name: jie.getName(),
    time: jie.getSolar().toYmdHms(),
  });
  return {
    previous: format(lunar.getPrevJie()),
    next: format(lunar.getNextJie()),
  };
}
