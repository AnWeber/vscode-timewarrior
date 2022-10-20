export interface CheckInAction {
  label: string;
  command: string;
  args?: Array<string> | (() => Promise<Array<string> | undefined>) | undefined;
}
