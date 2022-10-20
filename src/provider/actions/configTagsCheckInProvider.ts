import { getConfig } from '../../config';
import { CheckInAction } from './checkInAction';

export async function configTagsCheckInProvider(): Promise<Array<CheckInAction>> {
  const tags = getConfig().get('checkIn')?.tags;

  return tags?.map(obj => ({
    label: obj,
    command: 'start',
    args: [obj],
  })) || [];
}
