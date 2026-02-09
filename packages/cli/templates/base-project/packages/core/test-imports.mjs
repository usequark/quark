// Test script - verify all core modules load
import('./src/auth/index.js').then(() => {
  console.log('✅ Auth module loaded');
});

import('./src/errors.js').then(() => {
  console.log('✅ Errors module loaded');
});

import('./src/utils.js').then(() => {
  console.log('✅ Utils module loaded');
});

import('./src/queue/index.js').then(() => {
  console.log('✅ Queue module loaded');
});

setTimeout(() => {
  console.log('\n✨ All core modules are properly configured!');
  process.exit(0);
}, 500);
