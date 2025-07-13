export class Mutex {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return this.release;
    }

    return new Promise(resolve => {
      this.queue.push(() => {
        this.locked = true;
        resolve(this.release);
      });
    });
  }

  private release = () => {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  };

  async runExclusive<T>(callback: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await callback();
    } finally {
      release();
    }
  }
}