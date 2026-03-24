'use strict';
// Configurable task runner with dependency ordering and lifecycle hooks

class TaskRunner {
  constructor() {
    this.tasks = new Map();
    this.results = new Map();
  }

  register(name, options, fn) {
    if (typeof options === 'function') { fn = options; options = {}; }
    if (this.tasks.has(name)) throw new Error('Task already registered: ' + name);
    this.tasks.set(name, { name, deps: options.deps || [], fn, timeout: options.timeout || 30000 });
    return this;
  }

  _order() {
    const visited = new Set();
    const order = [];
    const visit = (name) => {
      if (visited.has(name)) return;
      visited.add(name);
      const task = this.tasks.get(name);
      if (!task) throw new Error('Unknown task: ' + name);
      task.deps.forEach(visit);
      order.push(name);
    };
    this.tasks.forEach((_, name) => visit(name));
    return order;
  }

  async run(name) {
    const order = name ? this._depsFor(name) : this._order();
    for (const taskName of order) {
      if (this.results.has(taskName)) continue;
      const task = this.tasks.get(taskName);
      const start = Date.now();
      try {
        const result = await Promise.race([
          task.fn(this.results),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), task.timeout)),
        ]);
        this.results.set(taskName, { ok: true, value: result, ms: Date.now() - start });
      } catch (err) {
        this.results.set(taskName, { ok: false, error: err.message, ms: Date.now() - start });
      }
    }
    return Object.fromEntries(this.results);
  }

  _depsFor(name) {
    const visited = new Set();
    const order = [];
    const visit = (n) => {
      if (visited.has(n)) return;
      visited.add(n);
      const t = this.tasks.get(n);
      if (t) t.deps.forEach(visit);
      order.push(n);
    };
    visit(name);
    return order;
  }

  reset() { this.results.clear(); return this; }
}

module.exports = TaskRunner;
