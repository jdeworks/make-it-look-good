// make-it-look-good — Background Computation Queue v1.1
// Async work queue with priority promotion. Items run one at a time,
// yielding to the event loop between items so the UI stays responsive.
// Clicking a viewport/page tab promotes that item to front of queue.

window.MilgQueue = (function() {
  "use strict";

  var _items = [];     // { id, priority, fn, onComplete, status }
  var _running = null; // currently executing item
  var _paused = false;

  // Add an item to the queue.
  // fn(callback): the work function. Must call callback(result) when done.
  // onComplete(result): called after fn finishes.
  // Returns the item (for later promote/cancel).
  function enqueue(id, fn, onComplete, priority) {
    // Dedup: if an item with same id is already queued or running, skip
    if (_running && _running.id === id) return _running;
    for (var i = 0; i < _items.length; i++) {
      if (_items[i].id === id) return _items[i];
    }
    var item = { id: id, priority: priority || 0, fn: fn, onComplete: onComplete || null, status: 'queued' };
    _items.push(item);
    _items.sort(function(a, b) { return b.priority - a.priority; });
    _scheduleNext();
    return item;
  }

  // Promote an item to highest priority (front of queue).
  // If an item with this id is currently running, no-op (already active).
  function promote(id) {
    if (_running && _running.id === id) return; // already running
    for (var i = 0; i < _items.length; i++) {
      if (_items[i].id === id) {
        var maxPri = _items.length > 0 ? _items[0].priority : 0;
        _items[i].priority = maxPri + 1;
        _items.sort(function(a, b) { return b.priority - a.priority; });
        return;
      }
    }
  }

  // Check if an item is done (result cached)
  function isDone(id) {
    // Not in queue and not running = either done or never queued
    if (_running && _running.id === id) return false;
    for (var i = 0; i < _items.length; i++) {
      if (_items[i].id === id) return false;
    }
    return true; // not found = already completed or never queued
  }

  // Cancel all items and reset
  function clear() {
    _items = [];
    _running = null;
    _paused = false;
  }

  // Pause processing (current item finishes, next doesn't start)
  function pause() { _paused = true; }
  function resume() { _paused = false; _scheduleNext(); }

  function _scheduleNext() {
    if (_running || _paused || _items.length === 0) return;
    setTimeout(_processNext, 0);
  }

  function _processNext() {
    if (_running || _paused || _items.length === 0) return;
    _running = _items.shift();
    _running.status = 'running';
    try {
      _running.fn(function(result) {
        var completed = _running;
        _running = null;
        completed.status = 'done';
        if (completed.onComplete) {
          try { completed.onComplete(result); } catch(e) { console.warn('[milg-queue] onComplete error:', e); }
        }
        // Yield then process next
        setTimeout(_processNext, 0);
      });
    } catch(e) {
      console.warn('[milg-queue] fn error:', e);
      _running = null;
      setTimeout(_processNext, 0);
    }
  }

  function pending() { return _items.length + (_running ? 1 : 0); }
  function currentId() { return _running ? _running.id : null; }

  return {
    enqueue: enqueue,
    promote: promote,
    isDone: isDone,
    clear: clear,
    pause: pause,
    resume: resume,
    pending: pending,
    currentId: currentId
  };
})();
