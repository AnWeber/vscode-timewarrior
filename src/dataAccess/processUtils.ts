import { spawn as spawnProcess, SpawnOptionsWithoutStdio } from 'child_process';
import { platform } from 'os';

export async function spawn(
  command: string,
  args?: string[],
  options?: SpawnOptionsWithoutStdio
): Promise<{ stdout: string; stderr: string }> {
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
        reject(new Error(`Terminated by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.join('') || `Process exited with code ${code}`));
        return;
      }
      resolve({ stdout: stdout.join(''), stderr: stderr.join('') });
    });
    process.on('error', err => {
      reject(err);
    });
  });
}

export async function timew(command: string, args?: string[]): Promise<{ stdout: string; stderr: string }> {
  if (platform() === 'win32') {
    return spawn('wsl', [`timew ${command}`, ...(args || [])]);
  }
  return spawn('timew', [command, ...(args || [])]);
}
