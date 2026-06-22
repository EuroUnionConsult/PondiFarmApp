const { withXcodeProject } = require('@expo/config-plugins');

/**
 * Config plugin: desliga ENABLE_USER_SCRIPT_SANDBOXING no projeto iOS.
 *
 * O Xcode 15+ liga o sandbox de run scripts por padrão; isso bloqueia a build
 * phase do dev-client que grava `ip.txt` dentro do .app
 * (Sandbox: bash deny file-write-create .../PondiFarm.app/ip.txt) e quebra o
 * build. Como o `ios/` é gerado por prebuild (CNG), aplicamos via plugin para
 * sobreviver a `expo prebuild --clean` e às builds do EAS.
 */
module.exports = function withDisableScriptSandboxing(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings;
      if (buildSettings) {
        buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return cfg;
  });
};
