try {
  const appModule = require('./dist/app');
  module.exports = appModule.default || appModule;
  if (require.main === module) {
    require('./dist/server');
  }
} catch (e) {
  require('ts-node/register');
  const appModule = require('./src/app');
  module.exports = appModule.default || appModule;
  if (require.main === module) {
    require('./src/server');
  }
}