import fs from 'node:fs';
import path from 'node:path';

// One local server instance; counters survive restarts. No utterances or keys are stored.
export class Budget {
  constructor(file, { dailyLimit = 50, intervalMs = 30000, now = Date.now } = {}) {
    this.file = file;
    this.dailyLimit = dailyLimit;
    this.intervalMs = intervalMs;
    this.now = now;
  }
  read() {
    try {
      const value = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (typeof value.day !== 'string' || !Number.isInteger(value.used) || value.used < 0
        || !Number.isFinite(value.last) || !Number.isFinite(value.blockedUntil)) throw new Error('Invalid budget');
      return value;
    } catch (e) {
      if (e.code === 'ENOENT') return { day: '', used: 0, last: 0, blockedUntil: 0 };
      throw e; // Fail closed if the counter cannot be read.
    }
  }
  write(value) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    // A partial write fails closed on the next read; no network request starts until this completes.
    fs.writeFileSync(this.file, JSON.stringify(value), { mode: 0o600, flush: true });
  }
  status() {
    const now = this.now();
    const value = this.read();
    const day = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
    return { value, day, now, used: value.day === day ? value.used : 0 };
  }
  reserve(intervalMs = this.intervalMs) {
    const { value, day, now, used } = this.status();
    if (now < value.blockedUntil) return 'provider_limit';
    if (used >= this.dailyLimit) return 'daily_limit';
    if (value.last && now - value.last < intervalMs) return 'cooldown';
    this.write({ day, used: used + 1, last: now, blockedUntil: value.blockedUntil });
    return 'ok';
  }
  block() {
    const value = this.read();
    // Do not repeatedly probe an exhausted provider quota. Pause this lab for 24 hours.
    this.write({ ...value, blockedUntil: this.now() + 86400000 });
  }
}
