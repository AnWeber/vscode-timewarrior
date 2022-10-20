import { DataFile } from '../../dataAccess';
import { getInputArgs } from './actionHelper';
import { CheckInAction } from './checkInAction';

export async function  startCheckInProvider(dataFile: DataFile | undefined): Promise<Array<CheckInAction>> {

  return [{
    label: 'start',
    command: 'start',
    args: () => getInputArgs(dataFile)
  }];
}