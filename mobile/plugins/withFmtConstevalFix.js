const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin: injeta um patch no `post_install` do Podfile que força
 * `FMT_USE_CONSTEVAL 0` no header do pod `fmt`.
 *
 * Porquê: o fmt 11.0.2 (bundled no React Native 0.81) escolhe o caminho
 * `consteval` para format-strings no clang do Xcode 26, que NÃO compila quando
 * o React Native é buildado a partir do código-fonte (`buildReactNativeFromSource`).
 * O `base.h` faz `#define FMT_USE_CONSTEVAL` incondicionalmente, então um `-D`
 * é ignorado — a única via fiável é patchar o header. Os ficheiros dos pods são
 * read-only, daí o `chmod` antes de escrever. Reaplicado a cada `pod install`.
 *
 * Como o `ios/` é gerado por prebuild (CNG), aplicamos via plugin para sobreviver
 * a `expo prebuild --clean` e às builds do EAS.
 */
const SNIPPET = `
    # [withFmtConstevalFix] fmt 11.0.2 consteval format-strings não compilam no
    # clang do Xcode 26 com React Native buildado do source. base.h faz #define
    # incondicional (ignora -D), então patchamos o header para o caminho runtime.
    fmt_base = File.join(installer.sandbox.root.to_s, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      src = File.read(fmt_base)
      patched = src.gsub('#  define FMT_USE_CONSTEVAL 1', '#  define FMT_USE_CONSTEVAL 0')
      if patched != src
        File.chmod(0644, fmt_base)
        File.write(fmt_base, patched)
      end
    end
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');

      if (contents.includes('withFmtConstevalFix')) {
        return cfg; // já aplicado
      }

      // Insere o snippet logo após a chamada react_native_post_install(...).
      const marker = /react_native_post_install\([\s\S]*?\)\n/;
      if (marker.test(contents)) {
        contents = contents.replace(marker, (m) => m + SNIPPET);
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
