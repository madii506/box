import { $, esc, api, chrome } from './core.js';
import { fx, watch } from './fx.js';
import { graveCard } from './ui.js';

await chrome('graveyard');
fx();
api('graveyard').then(d => {
  const list = d.list || [];
  $('#graves').innerHTML = list.length ? list.map(graveCard).join('') : '<div class="empty" style="grid-column:1/-1"><b>The Graveyard is empty.</b><span>Every box leaves one coin behind. The first one will rest here, next to the coin that was born instead.</span><a class="btn gold" href="/launch" style="margin-top:8px">Open a box <span class="arr">→</span></a></div>';
  watch();
}).catch(e => { $('#graves').innerHTML = `<div class="empty"><b>Could not reach the chain.</b><span>${esc(e.message)}</span></div>`; });
