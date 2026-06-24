Pod::Spec.new do |s|
  s.name           = 'LidarScanner'
  s.version        = '1.0.0'
  s.summary        = 'LiDAR scanner module for PondiFarm cattle measurement'
  s.description    = 'On-device ARKit LiDAR capture and morphometric measurement for PondiFarm.'
  s.author         = 'Talys Cordeiro'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '16.4'
  }
  s.source         = { git: 'https://github.com/EuroUnionConsult/PondiFarmApp.git', tag: s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
  # Testes standalone têm código top-level (asserts) ilegal num módulo multi-arquivo — excluir do build do pod.
  s.exclude_files = "**/*Tests.swift"
end
