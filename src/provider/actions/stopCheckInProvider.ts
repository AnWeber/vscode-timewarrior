import { DataFile } from '../../dataAccess';
import { CheckInAction } from './checkInAction';

export async function stopCheckInProvider(dataFile: DataFile | undefined): Promise<Array<CheckInAction>> {
  if (dataFile) {
    const interval = (await dataFile.getIntervals()).slice().pop();
    if (interval && !interval.end) {
      return [{
        label: 'stop',
        command: 'stop',
      }]
    }
  }
  return [];
}