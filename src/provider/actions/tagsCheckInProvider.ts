import { getConfig } from '../../config';
import { DataFile } from '../../dataAccess';
import { CheckInAction } from './checkInAction';

export async function tagsCheckInProvider(dataFile: DataFile | undefined): Promise<Array<CheckInAction>> {
  const countRecentlyUsedTags = getConfig().get('checkIn')?.countRecentlyUsedTags || 5;
  const tagList = await getRecentlyUsedTags(dataFile, countRecentlyUsedTags);
  return tagList.map(tag => ({
    label: tag.join(', '),
    command: 'start',
    args: tag,
  }));
}

export async function getRecentlyUsedTags(dataFile: DataFile | undefined, count: number) {
  const result: Array<Array<string>> = [];
  if (dataFile) {
    const intervals = await dataFile.getIntervals();

    for (const interval of intervals.reverse()) {
      if (interval.tags.length > 0 && !result.some(tags => equalsArray(tags, interval.tags))) {
        result.push([...interval.tags]);
      }
      if (result.length >= count) {
        return result;
      }
    }
  }
  return result;
}
function equalsArray<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length === arr2.length) {
    return arr1.every(obj1 => arr2.includes(obj1));
  }
  return false;
}
