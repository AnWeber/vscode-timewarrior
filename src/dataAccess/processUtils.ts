import { spawn as spawnProcess , SpawnOptionsWithoutStdio} from 'child_process';

export async function spawn(command: string, args?: string[], options?: SpawnOptionsWithoutStdio): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const process = spawnProcess(command, args, options);
    const stdout: Array<string> = [];
    const stderr: Array<string> = [];
    process.stdout.on('data', data => {
      stdout.push(data);
    });
    process.stderr.on('data', data => {
      stderr.push(data);
    });
    process.on('exit', (code, signal) => {
      if (code === null) {
        throw new Error(`Terminated by signal ${signal}`);
      }
      resolve({ stdout: stdout.join(''), stderr: stderr.join('') });
    });
    process.on('error', err => {
      reject(err);
    });
  });
}
