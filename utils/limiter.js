// utils/limiter.js
let active = 0;
const queue = [];
const MAX_CONCURRENT = 20; // only 20 requests at a time

async function runWithLimit(fn) {
  if (active >= MAX_CONCURRENT) {
    await new Promise(resolve => queue.push(resolve));
  }
  active++;
  try {
    return await fn();
  } finally {
    active--;
    if (queue.length) {
      const next = queue.shift();
      next();
    }
  }
}

module.exports = { runWithLimit };
