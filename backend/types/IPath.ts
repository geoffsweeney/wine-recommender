import * as path from 'path';

export interface IPath {
  join: typeof path.join;
  basename: typeof path.basename;
}
