import { DataFile } from '../../dataAccess';
import { CheckInAction } from './checkInAction';

export async function tagsCheckInProvider(dataFile: DataFile | undefined): Promise<Array<CheckInAction>> {
  const tagList = await getRecentlyUsedTags(dataFile);
  return tagList.map(obj => ({
    label: obj.join(' '),
    command: 'start',
    args: obj,
  }));
}

async function getRecentlyUsedTags(dataFile: DataFile | undefined, count = 3) {
  if (dataFile) {
    const intervals = await dataFile.getIntervals();

    return intervals.reduce((prev, curr) => {
      if (prev.length < count) {
        if (curr.tags.length > 0) {
          prev.push([...curr.tags]);
        }
      }
      return prev;
    }, [] as Array<Array<string>>);
  }
  return [];
}
