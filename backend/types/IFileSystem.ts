import * as fs from 'fs/promises';

export interface IFileSystem {
  readdir: typeof fs.readdir;
  readFile: typeof fs.readFile;
  stat: typeof fs.stat;
}
